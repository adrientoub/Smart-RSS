/**
 * The feed marketplace: a curated catalog the user can subscribe to in one click.
 *
 * Favicons are loaded straight from each publisher with a plain <img>, which
 * needs no host permission - unlike a fetch, which Firefox MV3 would block
 * until the user grants access to all sites.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Icon } from "./Icon.tsx";
import { addSourceByUrl, findSubscription, importOpmlFeeds } from "../actions.ts";
import { sources } from "../state/data.ts";
import { uiStore } from "../state/uiState.ts";
import { settings, useRecordVersion, useStoreState } from "../state/hooks.ts";
import { removeFeed } from "../state/commands.ts";
import { filterCatalog } from "../helpers/feedCatalogSearch.ts";
import { normalizeFeedUrl } from "../helpers/feedUrl.ts";
import {
    catalogCategories,
    feedCatalog,
    type CatalogCategory,
    type CatalogFeed,
} from "../staticdb/feedCatalog.ts";
import { translate } from "../../shared/i18n.ts";

const L = (key: string) => translate(key);

const FALLBACK_ICON = "/images/feed.png";

const faviconFor = (feed: CatalogFeed) => feed.favicon ?? new URL("/favicon.ico", feed.site).href;

const close = () => uiStore.setState({ marketplaceOpen: false });

interface Status {
    kind: "ok" | "error" | "busy";
    text: string;
}

export function Marketplace() {
    const open = useStoreState(uiStore, (state) => state.marketplaceOpen);
    if (!open) {
        return null;
    }
    return <MarketplaceOverlay />;
}

function MarketplaceOverlay() {
    const sourcesVersion = useRecordVersion(sources);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<CatalogCategory | null>(null);
    const [pending, setPending] = useState<readonly string[]>([]);
    const [ownUrl, setOwnUrl] = useState("");
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    const subscribed = useMemo(() => {
        const byUid = new Map<string, string>();
        for (const source of sources.all()) {
            if (source.uid) {
                byUid.set(source.uid, source.id);
            }
            if (source.url) {
                byUid.set(normalizeFeedUrl(source.url), source.id);
            }
        }
        return byUid;
        // sourcesVersion changes whenever the store does.
    }, [sourcesVersion]);

    const visible = useMemo(
        () => filterCatalog(feedCatalog, { search, category }),
        [search, category]
    );

    const add = async (feed: CatalogFeed) => {
        setPending((current) => [...current, feed.url]);
        try {
            settings.save("feedListVisible", true);
            await addSourceByUrl(feed.url, { title: feed.title, focus: false });
        } finally {
            setPending((current) => current.filter((url) => url !== feed.url));
        }
    };

    const addOwn = async (event: FormEvent) => {
        event.preventDefault();
        const entered = ownUrl.trim();
        if (!entered || busy) {
            return;
        }
        if (findSubscription(entered)) {
            setStatus({ kind: "error", text: L("ALREADY_SUBSCRIBED") });
            return;
        }
        setBusy(true);
        setStatus(null);
        try {
            settings.save("feedListVisible", true);
            await addSourceByUrl(entered, { focus: false });
            setOwnUrl("");
            setStatus({ kind: "ok", text: L("ADDED") });
        } finally {
            setBusy(false);
        }
    };

    const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Cleared so picking the same file again still fires a change event.
        event.target.value = "";
        if (!file || file.size === 0) {
            setStatus({ kind: "error", text: L("WRONG_FILE") });
            return;
        }
        setBusy(true);
        setStatus({ kind: "busy", text: L("IMPORTING_WAIT") });
        try {
            settings.save("feedListVisible", true);
            const { added } = await importOpmlFeeds(await file.text());
            setStatus({ kind: "ok", text: translate("OPML_IMPORTED", { count: String(added) }) });
        } catch {
            setStatus({ kind: "error", text: L("WRONG_FILE") });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="marketplace-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    close();
                }
            }}
            // Escape never reaches the global hotkey handler while a field has focus.
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    close();
                }
            }}
        >
            <section className="marketplace" role="dialog" aria-label={L("FEED_MARKETPLACE")}>
                <header className="marketplace-header">
                    <div className="marketplace-titles">
                        <h1 className="marketplace-title">{L("FEED_MARKETPLACE")}</h1>
                        <p className="marketplace-intro">{L("FEED_MARKETPLACE_INTRO")}</p>
                    </div>
                    <input
                        ref={searchRef}
                        className="marketplace-search"
                        // Not type="search": the focusSearch hotkey grabs the first one on the page.
                        type="text"
                        role="searchbox"
                        value={search}
                        placeholder={L("SEARCH_FEEDS")}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <button className="marketplace-close" title={L("CLOSE")} onClick={close}>
                        <Icon name="x" className="button-icon" />
                    </button>
                </header>

                <div className="marketplace-own">
                    <form className="marketplace-own-form" onSubmit={addOwn}>
                        <Icon name="rss" className="marketplace-own-icon" />
                        <input
                            className="marketplace-own-input"
                            type="text"
                            inputMode="url"
                            spellCheck={false}
                            autoComplete="off"
                            value={ownUrl}
                            placeholder="https://example.com/feed.xml"
                            aria-label={L("ADD_RSS_SOURCE")}
                            onChange={(event) => {
                                setOwnUrl(event.target.value);
                                setStatus(null);
                            }}
                        />
                        <button
                            className="marketplace-own-add"
                            type="submit"
                            disabled={busy || !ownUrl.trim()}
                        >
                            <Icon name="plus" className="button-icon" />
                            {L("ADD")}
                        </button>
                    </form>

                    <span className="marketplace-own-separator">{L("OR")}</span>

                    <button
                        className="marketplace-own-opml"
                        disabled={busy}
                        onClick={() => fileRef.current?.click()}
                    >
                        <Icon name="download" className="button-icon" />
                        {L("IMPORT_OPML")}
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".opml,.xml,text/xml,application/xml"
                        hidden
                        onChange={importFile}
                    />

                    {status ? (
                        <p className={"marketplace-own-status " + status.kind}>{status.text}</p>
                    ) : null}
                </div>

                <div className="marketplace-categories">
                    <button
                        className={"marketplace-chip" + (category ? "" : " active")}
                        onClick={() => setCategory(null)}
                    >
                        {L("ALL_CATEGORIES")}
                    </button>
                    {catalogCategories.map((entry) => (
                        <button
                            key={entry.id}
                            className={
                                "marketplace-chip" + (category === entry.id ? " active" : "")
                            }
                            onClick={() => setCategory(entry.id)}
                        >
                            {L(entry.labelKey)}
                        </button>
                    ))}
                </div>

                {visible.length === 0 ? (
                    <p className="marketplace-empty">{L("NO_FEEDS_FOUND")}</p>
                ) : (
                    <ul className="marketplace-grid">
                        {visible.map((feed) => {
                            const sourceId = subscribed.get(normalizeFeedUrl(feed.url)) ?? null;
                            return (
                                <MarketplaceCard
                                    key={feed.url}
                                    feed={feed}
                                    sourceId={sourceId}
                                    busy={pending.includes(feed.url)}
                                    onAdd={() => add(feed)}
                                    onRemove={() => sourceId && removeFeed(sourceId)}
                                />
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}

interface CardProps {
    feed: CatalogFeed;
    /** The subscription this catalog entry corresponds to, if there is one. */
    sourceId: string | null;
    busy: boolean;
    onAdd: () => void;
    onRemove: () => void;
}

function MarketplaceCard({ feed, sourceId, busy, onAdd, onRemove }: CardProps) {
    const [hovered, setHovered] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const added = sourceId !== null;
    const removing = added && hovered;

    useEffect(() => {
        if (!added) {
            setConfirming(false);
        }
    }, [added]);

    return (
        <li className={"marketplace-card" + (confirming ? " confirming" : "")}>
            <img
                className="marketplace-favicon"
                src={faviconFor(feed)}
                alt=""
                loading="lazy"
                onError={(event) => {
                    const image = event.currentTarget;
                    if (!image.src.endsWith(FALLBACK_ICON)) {
                        image.src = FALLBACK_ICON;
                    }
                }}
            />
            <div className="marketplace-card-body">
                <a
                    className="marketplace-card-title"
                    href={feed.site}
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    {feed.title}
                    <Icon name="external-link" className="marketplace-card-link-icon" />
                </a>
                <p className="marketplace-card-description">{feed.description}</p>
            </div>
            {confirming ? (
                <div
                    className="marketplace-confirm"
                    title={L("REALLY_DELETE")}
                    // Escape would otherwise close the whole marketplace.
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            event.stopPropagation();
                            setConfirming(false);
                        }
                    }}
                >
                    <button className="marketplace-confirm-delete" onClick={onRemove}>
                        <Icon name="trash" className="button-icon" />
                        {L("DELETE")}
                    </button>
                    <button
                        className="marketplace-confirm-cancel"
                        autoFocus
                        onClick={() => setConfirming(false)}
                    >
                        {L("CANCEL")}
                    </button>
                </div>
            ) : (
                <button
                    className={
                        "marketplace-add" + (added ? " added" : "") + (removing ? " removing" : "")
                    }
                    disabled={busy}
                    onClick={added ? () => setConfirming(true) : onAdd}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onFocus={() => setHovered(true)}
                    onBlur={() => setHovered(false)}
                >
                    <Icon
                        name={removing ? "trash" : added ? "check" : "plus"}
                        className="button-icon"
                    />
                    {removing ? L("DELETE") : added ? L("ADDED") : L("ADD")}
                </button>
            )}
        </li>
    );
}
