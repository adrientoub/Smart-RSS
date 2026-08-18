/**
 * @module BgProcess
 * @submodule models/Loader
 *
 * Updates feeds and keeps track of progress. Sources are tracked by id: records
 * are immutable, so a stored record would go stale as soon as it is written to.
 */
import animation from "../modules/Animation.ts";
import FeedLoader from "./FeedLoader.ts";
import { settingsStore } from "../../shared/settings.ts";
import { folders, items, sources } from "../../shared/stores.ts";
import { itemRepository } from "../modules/repositories.ts";
import { refreshCounters } from "../modules/counters.ts";
import { translate } from "../../shared/i18n.ts";

const settings = settingsStore();

export default class Loader {
    private port: browser.runtime.Port | null = null;
    private _maxSources = 0;
    private _loaded = 0;
    private _loading = false;

    /** Source ids queued for download, and those a worker has picked up. */
    sourcesToLoad: string[] = [];
    sourcesLoading: string[] = [];
    itemsDownloaded = false;
    loaders: FeedLoader[] = [];
    timestamps: Record<string, number> = {};

    constructor() {
        browser.runtime.onConnect.addListener((port) => this.connected(port));
    }

    connected(port: browser.runtime.Port): void {
        this.port = port;
        port.onDisconnect.addListener(() => {
            this.port = null;
        });
    }

    private post(key: string, value: unknown): void {
        this.port?.postMessage({ key, value });
    }

    get loading(): boolean {
        return this._loading;
    }

    set loading(value: boolean) {
        this._loading = value;
        this.post("loading", value);
    }

    get loaded(): number {
        return this._loaded;
    }

    set loaded(value: number) {
        this._loaded = value;
        this.post("loaded", value);
    }

    get maxSources(): number {
        return this._maxSources;
    }

    set maxSources(value: number) {
        this._maxSources = value;
        this.post("maxSources", value);
    }

    /** Accepts source ids and folder ids; a folder expands to its sources. */
    addSourceIds(ids: readonly string[]): void {
        for (const id of ids) {
            if (folders.has(id)) {
                this.addSourceIds(sources.where({ folderID: id }).map((source) => source.id));
                continue;
            }
            if (!sources.has(id) || this.sourcesToLoad.includes(id)) {
                continue;
            }
            this.sourcesToLoad.push(id);
            this.maxSources = this.maxSources + 1;
        }
    }

    abortDownloading(): void {
        this.sourcesToLoad = [];
        this.loaders.forEach((loader) => loader.abort());
        this.loaders = [];
        this.sourcesLoading = [];
        this.workersFinished();
    }

    startDownloading(): void {
        const workersRunning = this.loaders.length;
        this.loading = true;
        animation.start();
        const maxWorkers = Math.min(settings.get("concurrentDownloads"), this.sourcesToLoad.length);
        const workers = Math.max(0, maxWorkers - workersRunning);
        for (let i = 0; i < workers; i++) {
            const feedLoader = new FeedLoader(this);
            this.loaders.push(feedLoader);
            feedLoader.downloadNext();
        }
    }

    download(ids: readonly string[] | string): void {
        const list = typeof ids === "string" ? [ids] : ids;
        if (!list?.length) {
            return;
        }
        this.addSourceIds(list);
        this.startDownloading();
    }

    downloadAll(force?: boolean): void {
        let queued = sources.all();
        if (!force) {
            const globalUpdateFrequency = settings.get("updateFrequency");
            queued = queued.filter((source) => {
                const sourceUpdateFrequency = source.updateEvery;
                if (sourceUpdateFrequency === 0) {
                    return false;
                }
                const updateFrequency =
                    sourceUpdateFrequency > 0 ? sourceUpdateFrequency : globalUpdateFrequency;
                if (updateFrequency === 0) {
                    return false;
                }
                if (!source.lastChecked) {
                    return true;
                }
                const multiplier = 1 + source.errorCount;
                // Reduced by a minute so an early start does not push the next
                // run a whole cycle out.
                const finalFrequency =
                    Math.min(updateFrequency * 60 * 1000 * multiplier, 7 * 24 * 60 * 60 * 1000) -
                    60 * 1000;
                return source.lastChecked <= Date.now() - finalFrequency;
            });
        }
        if (queued.length === 0) {
            return;
        }
        this.addSourceIds(queued.map((source) => source.id));
        this.startDownloading();
    }

    handleNotifications(): void {
        if (settings.get("systemNotifications")) {
            browser.notifications.create({
                type: "basic",
                title: "Smarter RSS",
                message: translate("NEW_ARTICLES_FOUND"),
            });
        }
    }

    workerFinished(worker: FeedLoader): void {
        const index = this.loaders.indexOf(worker);
        if (index > -1) {
            this.loaders.splice(index, 1);
        }
        if (this.loaders.length > 0) {
            return;
        }
        this.workersFinished();
    }

    workersFinished(): void {
        // Articles whose source is gone should not happen, but did.
        const orphans = items.filter((item) => !sources.has(String(item.sourceID)));
        if (orphans.length) {
            itemRepository.remove(orphans.map((item) => item.id));
            refreshCounters();
        }
        if (this.itemsDownloaded) {
            this.handleNotifications();
        }
        this.maxSources = 0;
        this.loaded = 0;
        this.loading = false;
        this.itemsDownloaded = false;
        this.sourcesToLoad = [];
        this.loaders = [];
        this.sourcesLoading = [];
        animation.stop();
    }

    sourceLoaded(id: string): void {
        this.loaded++;
        const index = this.sourcesLoading.indexOf(id);
        if (index > -1) {
            this.sourcesLoading.splice(index, 1);
        }
    }
}
