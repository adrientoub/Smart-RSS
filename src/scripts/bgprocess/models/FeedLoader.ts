/**
 * @module BgProcess
 * @submodule models/FeedLoader
 *
 * Downloads one source at a time for its owning {@link Loader}. The source is
 * held by id: records are immutable, so the current one is read back from the
 * store on every use.
 */
import RSSParser, { type ParsedItem } from "../modules/RSSParser.ts";
import { getFavicon } from "../modules/favicon.ts";
import { articlesDiffer } from "../modules/articleDiff.ts";
import { getElementSetting } from "../../shared/elementSettings.ts";
import { settingsStore } from "../../shared/settings.ts";
import { items, sources } from "../../shared/stores.ts";
import { itemRepository, sourceRepository } from "../modules/repositories.ts";
import { markDeletedAttrs, sourcePassword, type ItemRecord } from "../../shared/records.ts";
import type { SourceRecord } from "../../shared/records.ts";
import type Loader from "./Loader.ts";

const settings = settingsStore();

const REQUEST_TIMEOUT_MS = 1000 * 15; // TODO: make configurable

const escapeRegExp = (text: string) => String(text).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");

const stripDiacritics = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default class FeedLoader {
    private readonly loader: Loader;
    private readonly controller = new AbortController();
    private sourceId: string | undefined;

    // Mirrors the XMLHttpRequest fields the rest of the class was written against.
    private status = 0;
    private responseUrl: string | null = null;
    private responseText = "";

    constructor(loader: Loader) {
        this.loader = loader;
    }

    private get source(): SourceRecord | undefined {
        return sources.get(this.sourceId);
    }

    private save(attrs: Partial<SourceRecord>): void {
        if (this.sourceId) {
            sourceRepository.update([this.sourceId], attrs);
        }
    }

    /** Transient state: persisting it would survive a restart as a stuck spinner. */
    private setLoading(isLoading: boolean): void {
        if (this.sourceId) {
            sources.update(this.sourceId, { isLoading });
        }
    }

    abort(): void {
        this.controller.abort();
    }

    onAbort(): void {
        this.setLoading(false);
    }

    private parseProxyResponse(source: SourceRecord): Partial<ParsedItem>[] {
        const response = JSON.parse(this.responseText);
        return response.items.map((item: Record<string, any>) => {
            const canonical = item.canonical ? item.canonical[0] : item.alternate[0];
            return {
                id: item.originId,
                title: item.title,
                url: canonical.href,
                date: item.updated ? item.updated : item.published ? item.published : Date.now(),
                author: item.author ? item.author : "",
                content: item.content ? item.content.content : item.summary.content,
                sourceID: source.id,
                dateCreated: Date.now(),
            };
        });
    }

    private parseResponse(source: SourceRecord): ParsedItem[] {
        const parser = new RSSParser(this.responseText, {
            id: source.id,
            url: source.url,
            base: source.base,
            title: source.title,
        });
        const { items: parsedItems, sourceData } = parser.parse();
        // The parser is pure, so persisting what it discovered is done here.
        this.save(sourceData as Partial<SourceRecord>);
        return parsedItems;
    }

    private matchesQuery(item: { title: string; author: string; content: string }): boolean {
        return settings.get("queries").some((rawQuery: string) => {
            let query = rawQuery.trim();
            if (!query) {
                return false;
            }
            let searchInContent = false;
            if (query[0] === ":") {
                query = query.replace(/^:/, "");
                searchInContent = true;
            }
            if (!query) {
                return false;
            }
            const expression = new RegExp(escapeRegExp(query), "i");
            return (
                expression.test(stripDiacritics(item.title)) ||
                expression.test(stripDiacritics(item.author)) ||
                (searchInContent && expression.test(stripDiacritics(item.content)))
            );
        });
    }

    onLoad(): unknown {
        const source = this.source;
        if (!source) {
            return this.onFeedProcessed({ success: false });
        }

        let parsedData: Partial<ParsedItem>[];
        try {
            parsedData = source.proxyThroughFeedly
                ? this.parseProxyResponse(source)
                : this.parseResponse(source);
        } catch (error) {
            console.log(`Couldn't parse`, source.url, error);
            return this.onFeedProcessed({ success: false });
        }

        const sourceID = source.id;
        let modelUrl = source.url;
        let lastArticle = source.lastArticle;
        let foundNewArticles = false;

        const currentItems = items.where({ sourceID });
        const earliestDate = Math.min(0, ...currentItems.map((item) => item.date));

        const insert: (Partial<ItemRecord> & { id: string })[] = [];

        parsedData.forEach((item) => {
            const existing = items.get(item.id) ?? items.get((item as ParsedItem).oldId);

            if (existing) {
                if (existing.deleted) {
                    return;
                }
                if (
                    articlesDiffer(
                        { title: existing.title, content: existing.content },
                        { title: item.title, content: item.content }
                    )
                ) {
                    insert.push({
                        id: existing.id,
                        content: item.content,
                        title: item.title,
                        date: item.date,
                        author: item.author,
                        enclosure: item.enclosure,
                        unread: true,
                        visited: false,
                        parsedContent: {},
                    });
                }
                return;
            }
            if (earliestDate > item.date) {
                console.log(
                    "discarding entry with date older than the earliest know article in the feed",
                    modelUrl
                );
                return;
            }
            foundNewArticles = true;
            insert.push({
                ...(item as Partial<ItemRecord>),
                id: item.id,
                pinned: this.matchesQuery({
                    title: item.title ?? "",
                    author: item.author ?? "",
                    content: item.content ?? "",
                }),
            });
            lastArticle = Math.max(lastArticle, item.date);
        });

        itemRepository.put(insert);

        if (foundNewArticles) {
            this.loader.itemsDownloaded = true;
            // Drop tombstones the feed no longer lists, so they stop taking space.
            const fetchedIDs = new Set(parsedData.map((item) => item.id));
            const stale = items
                .where({ sourceID, deleted: true })
                .filter((item) => !item.emptyDate && !fetchedIDs.has(item.id));
            itemRepository.remove(stale.map((item) => item.id));
        }

        if (this.responseUrl && this.responseUrl !== modelUrl) {
            modelUrl = this.responseUrl;
        }

        const update: Partial<SourceRecord> = {
            lastUpdate: Date.now(),
            hasNew: foundNewArticles || source.hasNew,
            lastStatus: 200,
            lastArticle,
            url: modelUrl,
        };

        // Re-read: parsing wrote `base` back, and records are replaced on update.
        const current = this.source ?? source;
        // Without a base there is nothing to ask; retry after the next parse.
        if (current.base && current.faviconExpires < Math.round(Date.now() / 1000)) {
            return getFavicon(current)
                .then(
                    (response) => {
                        update.favicon = response.favicon;
                        update.faviconExpires = response.faviconExpires;
                    },
                    (error) => {
                        update.faviconExpires = Math.round(Date.now() / 1000) + 60 * 60 * 24 * 7;
                        console.warn(`Couldn't load favicon for:`, modelUrl, error);
                    }
                )
                .finally(() => this.onFeedProcessed({ data: update }));
        }

        return this.onFeedProcessed({ data: update });
    }

    onTimeout(): unknown {
        return this.onFeedProcessed({ success: false });
    }

    onError(): unknown {
        this.save({ lastStatus: this.status });
        return this.onFeedProcessed({ success: false, isOnline: this.status > 0 });
    }

    private autoRemoveDays(source: SourceRecord): number {
        return source.autoremove === -1
            ? Number(settings.get("autoremove"))
            : Number(source.autoremove);
    }

    removeOldItems(source: SourceRecord): void {
        const autoRemove = this.autoRemoveDays(source);
        if (!autoRemove) {
            return;
        }
        const filter: Partial<ItemRecord> = {
            sourceID: source.id,
            deleted: false,
            pinned: false,
        };

        const autoRemoveSetting = getElementSetting(source, "autoremovesetting");
        if (autoRemoveSetting === "KEEP_UNVISITED") {
            filter.visited = true;
        }
        if (autoRemoveSetting === "KEEP_UNREAD") {
            filter.unread = false;
            filter.visited = true;
        }

        const now = Date.now();
        const removalDelayInMs = autoRemove * 24 * 60 * 60 * 1000;
        const expired = items
            .where(filter)
            .filter((item) => now - (item.dateCreated || item.date) > removalDelayInMs);
        if (expired.length) {
            itemRepository.update(
                expired.map((item) => item.id),
                markDeletedAttrs()
            );
        }
    }

    onFeedProcessed(
        result: { success?: boolean; isOnline?: boolean; data?: Partial<SourceRecord> } = {}
    ): unknown {
        const source = this.source;
        const success = "success" in result ? result.success : true;
        const isOnline =
            "isOnline" in result
                ? result.isOnline &&
                  (typeof navigator.onLine !== "undefined" ? navigator.onLine : true)
                : true;

        if (source) {
            if (success && isOnline) {
                this.removeOldItems(source);
            }
            const data: Partial<SourceRecord> = {
                ...(result.data ?? {}),
                lastChecked: Date.now(),
                errorCount: success ? 0 : isOnline ? source.errorCount + 1 : source.errorCount,
                folderID: source.folderID === "" ? "0" : source.folderID,
            };
            this.setLoading(false);
            this.save(data);
            this.loader.sourceLoaded(source.id);
        }
        return this.downloadNext();
    }

    downloadNext(): unknown {
        this.sourceId = this.loader.sourcesToLoad.shift();
        const source = this.source;
        if (!source) {
            return this.sourceId ? this.downloadNext() : this.loader.workerFinished(this);
        }
        if (this.loader.sourcesLoading.includes(source.id)) {
            // May happen if the source is still loading after the last attempt.
            return this.downloadNext();
        }

        let sourceUrl = source.url;
        const origin = new URL(sourceUrl).origin;
        return navigator.locks
            .request(origin, () => {
                if (
                    Date.now() < (this.loader.timestamps[origin] || 0) + 1000 &&
                    origin.includes("openrss.org")
                ) {
                    return false;
                }
                this.loader.timestamps[origin] = Date.now();
                return true;
            })
            .then((canContinue) => {
                if (!canContinue) {
                    this.loader.sourcesToLoad.push(source.id);
                    return this.downloadNext();
                }

                this.loader.sourcesLoading.push(source.id);
                if (settings.get("showSpinner")) {
                    this.setLoading(true);
                }

                const shouldUseFeedlyCache = source.proxyThroughFeedly;
                if (shouldUseFeedlyCache) {
                    const newest = items
                        .where({ sourceID: source.id })
                        .reduce((date, item) => Math.max(date, item.date), 0);
                    sourceUrl =
                        "https://cloud.feedly.com/v3/streams/contents?streamId=feed%2F" +
                        encodeURIComponent(sourceUrl) +
                        "&count=1000&newerThan=" +
                        newest;
                }

                const headers: Record<string, string> = {};
                let credentials: RequestCredentials = "same-origin";
                // Forbidden header name; browsers drop it. Kept for parity with
                // the previous XHR call, which could not set it either.
                if (sourceUrl.startsWith("https://openrss.org/")) {
                    headers["User-Agent"] = navigator.userAgent + " + SmartRSS";
                }
                if (!shouldUseFeedlyCache && (source.username || source.password)) {
                    credentials = "include";
                    headers.Authorization =
                        "Basic " + btoa(`${source.username || ""}:${sourcePassword(source)}`);
                }

                return this.send(sourceUrl, { headers, credentials });
            });
    }

    /**
     * Maps fetch outcomes onto the XHR events this class was written against:
     * any completed HTTP response is a "load" regardless of status, and only
     * network-level failures are errors.
     */
    async send(
        sourceUrl: string,
        {
            headers,
            credentials,
        }: { headers: Record<string, string>; credentials: RequestCredentials }
    ): Promise<unknown> {
        const signal = AbortSignal.any([
            this.controller.signal,
            AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ]);

        try {
            const response = await fetch(sourceUrl, { headers, credentials, signal });
            this.status = response.status;
            this.responseUrl = response.url;
            this.responseText = await response.text();
        } catch (error) {
            if ((error as Error).name === "TimeoutError") {
                return this.onTimeout();
            }
            if ((error as Error).name === "AbortError") {
                return this.onAbort();
            }
            return this.onError();
        }

        return this.onLoad();
    }
}
