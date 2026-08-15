/**
 * Every executable command in the reader, keyed `region:name`.
 *
 * Actions are looked up by toolbars, context menus, and the hotkey table. They
 * used to be a Backbone collection of models purely to get `get()` by id.
 */
import stripTags from "./helpers/stripTags.js";
import { translate } from "../shared/i18n.ts";
import { sendMessage } from "../shared/messages.ts";
import { settingsStore } from "../shared/settings.ts";
import { prefersDarkScheme, resolveTheme, toggledTheme } from "../shared/theme.ts";
import { createRecord, destroyRecords, idsOf, updateRecords } from "../shared/dataClient.ts";
import type { SettingKey } from "../shared/settingsSchema.ts";
import { folders, items, sources } from "./state/data.ts";
import { setFocus, hideOverlays, ui, uiStore } from "./state/uiState.ts";
import * as commands from "./state/commands.ts";
import { selectedSources, selectedArticles, contentArticle } from "./state/selectors.ts";
import { normalizeFeedUrl } from "./helpers/feedUrl.ts";

const settings = settingsStore();
const L = (key: string) => translate(key);

export interface ActionDefinition {
    title: string | (() => string);
    icon?: string | (() => string);
    /** A boolean setting the button reflects as an "active" state. */
    state?: SettingKey;
    fn: (event?: any) => void | Promise<void>;
}

export function fixURL(url: string): string {
    return url.search(/[a-z]+:\/\//) === -1 ? "https://" + url : url;
}

/** The folder a new feed lands in: the selected one, or the root. */
function targetFolderID(): string {
    const selectedFolder = ui().feedSelection.selected.find((key) => key.startsWith("folder:"));
    if (selectedFolder) {
        const id = selectedFolder.slice("folder:".length);
        if (folders.has(id)) {
            return id;
        }
    }
    return "0";
}

export interface AddSourceOptions {
    title?: string;
    folderID?: string;
    /** Reveal and select the feed once it exists. */
    focus?: boolean;
}

/**
 * Subscribes to a feed, or focuses the existing subscription. Returns its id.
 *
 * Shared by the toolbar prompt and the feed marketplace so both go through the
 * same duplicate check.
 */
export async function addSourceByUrl(
    entered: string,
    { title, folderID = targetFolderID(), focus = true }: AddSourceOptions = {}
): Promise<string | null> {
    const trimmed = entered.trim();
    if (!trimmed) {
        return null;
    }
    const url = fixURL(trimmed);
    const duplicate = sources.findWhere({ uid: normalizeFeedUrl(url) });

    if (focus) {
        settings.save("feedListVisible", true);
    }
    if (duplicate) {
        if (focus) {
            commands.focusFeed(duplicate.id);
        }
        return duplicate.id;
    }
    // Awaited for the new feed's id, which the background generates.
    const { id } = await createRecord("sources", {
        title: title || url,
        url,
        updateEvery: -1,
        folderID,
    });
    if (focus) {
        commands.focusFeed(id);
    }
    return id;
}

const contentFrame = () => document.querySelector("iframe") as HTMLIFrameElement | null;

const scrollFrame = (dx: number, dy: number) => {
    contentFrame()?.contentWindow?.scrollBy(dx, dy);
};

export const actions: Record<string, Record<string, ActionDefinition>> = {
    global: {
        default: {
            title: L("UNKNOWN"),
            fn: () => alert(L("NO_ACTION")),
        },
        hideOverlays: {
            title: L("HIDE_OVERLAYS"),
            fn: hideOverlays,
        },
        openOptions: {
            title: L("OPTIONS"),
            icon: "settings",
            fn: () => browser.runtime.openOptionsPage(),
        },
    },

    feeds: {
        toggleFeedList: {
            icon: "panel-left",
            title: () => {
                const preference = settings.get("feedListVisible");
                return (preference ?? sources.size === 0)
                    ? L("HIDE_FEED_LIST")
                    : L("SHOW_FEED_LIST");
            },
            fn: () => {
                const preference = settings.get("feedListVisible") ?? sources.size === 0;
                settings.save("feedListVisible", !preference);
            },
        },
        toggleShowOnlyUnread: {
            icon: "filter",
            state: "showOnlyUnreadSources",
            title: L("TOGGLE_SHOW_ONLY_UNREAD"),
            fn: () =>
                settings.save("showOnlyUnreadSources", !settings.get("showOnlyUnreadSources")),
        },
        updateAll: {
            icon: "refresh",
            title: L("UPDATE_ALL"),
            fn: () => sendMessage("load-all"),
        },
        update: {
            icon: "refresh",
            title: L("UPDATE"),
            fn: () => {
                const ids = ui().feedSelection.selected.map((key) => key.split(":")[1]);
                if (ids.length) {
                    sendMessage("download-sources", { ids });
                }
            },
        },
        stopUpdate: {
            icon: "stop",
            title: L("STOP_UPDATE"),
            fn: () => sendMessage("abort-downloads"),
        },
        mark: {
            icon: "check-all",
            title: L("MARK_ALL_AS_READ"),
            fn: commands.markSelectedFeedsAsRead,
        },
        openHome: {
            title: L("OPEN_HOME"),
            fn: () => {
                selectedSources().forEach((source) => {
                    browser.tabs.create({ url: source.base, active: false });
                });
            },
        },
        refetch: {
            title: L("REFETCH"),
            // Awaited so the refresh cannot re-insert articles still being dropped.
            fn: async () => {
                const feeds = selectedSources();
                if (!feeds.length) {
                    return;
                }
                const ids = new Set(feeds.map((source) => source.id));
                const stale = items.filter((item) => ids.has(String(item.sourceID)));
                await destroyRecords("items", idsOf(stale));
                sendMessage("download-sources", { ids: [...ids] });
            },
        },
        delete: {
            icon: "trash",
            title: L("DELETE"),
            fn: commands.deleteSelectedFeeds,
        },
        showProperties: {
            icon: "info",
            title: L("PROPERTIES"),
            fn: commands.showProperties,
        },
        addSource: {
            icon: "plus",
            title: L("ADD_RSS_SOURCE"),
            fn: async () => {
                await addSourceByUrl(prompt(L("RSS_FEED_URL")) || "");
            },
        },
        openMarketplace: {
            icon: "store",
            title: L("FEED_MARKETPLACE"),
            fn: () => uiStore.setState({ marketplaceOpen: true }),
        },
        addFolder: {
            icon: "folder-plus",
            title: L("NEW_FOLDER"),
            fn: () => {
                const title = (prompt(L("FOLDER_NAME") + ": ") || "").trim();
                if (title) {
                    createRecord("folders", { title });
                }
            },
        },
        focus: {
            title: L("FOCUS_FEEDS"),
            fn: () => setFocus("feeds"),
        },
        selectNext: {
            title: L("SELECT_NEXT_FEED"),
            fn: (event) => commands.selectFeedSibling(1, event ?? {}),
        },
        selectPrevious: {
            title: L("SELECT_PREVIOUS_FEED"),
            fn: (event) => commands.selectFeedSibling(-1, event ?? {}),
        },
        closeFolders: {
            title: L("CLOSE_FOLDERS"),
            fn: () => commands.setAllFoldersOpen(false),
        },
        openFolders: {
            title: L("OPEN_FOLDERS"),
            fn: () => commands.setAllFoldersOpen(true),
        },
        toggleFolder: {
            title: L("TOGGLE_FOLDER"),
            fn: () => {
                const key = ui().feedSelection.selected.find((entry) =>
                    entry.startsWith("folder:")
                );
                if (key) {
                    commands.toggleFolder(key.slice("folder:".length));
                }
            },
        },
        showArticles: {
            title: L("SHOW_ARTICLES"),
            fn: (event) => commands.showArticles(event ?? {}),
        },
        showAndFocusArticles: {
            title: L("SHOW_AND_FOCUS_ARTICLES"),
            fn: (event) => commands.showAndFocusArticles(event ?? {}),
        },
    },

    articles: {
        mark: {
            icon: "circle-check",
            title: L("MARK_AS_READ"),
            fn: () => commands.changeUnreadState(),
        },
        toggleShowOnlyUnread: {
            icon: "filter",
            state: "defaultToUnreadOnly",
            title: L("DEFAULT_TO_UNREAD_ONLY"),
            fn: () => settings.save("defaultToUnreadOnly", !settings.get("defaultToUnreadOnly")),
        },
        update: {
            icon: "refresh",
            title: L("UPDATE"),
            fn: () => {
                const feeds = ui().query.feeds;
                if (feeds.length) {
                    sendMessage("download-sources", { ids: feeds });
                } else {
                    sendMessage("load-all");
                }
            },
        },
        delete: {
            icon: "trash",
            title: () => (ui().query.name === "trash" ? L("DELETE_PERMANENTLY") : L("DELETE")),
            fn: (event) => {
                if (ui().query.name === "trash" || event?.shiftKey) {
                    if (!confirm(L("REMOVE_SELECTED_PERMANENTLY"))) {
                        return;
                    }
                    commands.deleteSelectedArticlesPermanently();
                    return;
                }
                commands.trashSelectedArticles();
            },
        },
        undelete: {
            icon: "undo",
            title: L("UNDELETE"),
            fn: commands.undeleteSelectedArticles,
        },
        selectNext: {
            title: L("SELECT_NEXT_ARTICLE"),
            fn: (event) => commands.selectArticleSibling(1, event ?? {}),
        },
        selectPrevious: {
            title: L("SELECT_PREVIOUS_ARTICLE"),
            fn: (event) => commands.selectArticleSibling(-1, event ?? {}),
        },
        search: {
            title: L("SEARCH_TIP"),
            fn: (event) => {
                const input = event?.currentTarget as HTMLInputElement | undefined;
                commands.setSearch(input ? input.value : "");
            },
        },
        focusSearch: {
            title: L("FOCUS_SEARCH"),
            fn: () => document.querySelector<HTMLInputElement>("input[type=search]")?.focus(),
        },
        focus: {
            title: L("FOCUS_ARTICLES"),
            fn: () => setFocus("articles"),
        },
        fullArticle: {
            title: L("FULL_ARTICLE"),
            icon: "external-link",
            fn: (event) => {
                const selected = selectedArticles();
                if (!selected.length) {
                    return;
                }
                if (selected.length > 10 && settings.get("askOnOpening")) {
                    if (!confirm("Do you really want to open " + selected.length + " articles?")) {
                        return;
                    }
                }
                const active =
                    settings.get("openNewTab") === "background"
                        ? Boolean(event?.shiftKey)
                        : !event?.shiftKey;
                selected.forEach((item) => {
                    browser.tabs.create({ url: stripTags(item.url), active });
                });
            },
        },
        oneFullArticle: {
            title: L("FULL_ARTICLE_SINGLE"),
            fn: (event) => {
                const item = selectedArticles()[0];
                if (!item) {
                    return;
                }
                const active =
                    settings.get("openNewTab") === "background"
                        ? Boolean(event?.shiftKey)
                        : !event?.shiftKey;
                browser.tabs.create({ url: stripTags(item.url), active });
            },
        },
        markAndNextUnread: {
            title: L("MARK_AND_NEXT_UNREAD"),
            icon: "check-down",
            fn: () => {
                commands.changeUnreadState({ onlyToRead: true });
                commands.selectArticleSibling(1, { selectUnread: true });
            },
        },
        markAndPrevUnread: {
            title: L("MARK_AND_PREV_UNREAD"),
            icon: "check-up",
            fn: () => {
                commands.changeUnreadState({ onlyToRead: true });
                commands.selectArticleSibling(-1, { selectUnread: true });
            },
        },
        nextUnread: {
            title: L("NEXT_UNREAD"),
            icon: "chevron-down",
            fn: () => commands.selectArticleSibling(1, { selectUnread: true }),
        },
        prevUnread: {
            title: L("PREV_UNREAD"),
            icon: "chevron-up",
            fn: () => commands.selectArticleSibling(-1, { selectUnread: true }),
        },
        markAllAsRead: {
            title: L("MARK_ALL_AS_READ"),
            icon: "check-all",
            fn: commands.markQueryAsRead,
        },
        selectAll: {
            title: L("SELECT_ALL_ARTICLES"),
            fn: commands.selectAllArticles,
        },
        pin: {
            title: L("PIN"),
            icon: "pin",
            fn: commands.togglePinned,
        },
        spaceThrough: {
            title: L("SPACE_THROUGH"),
            fn: () => {
                if (selectedArticles().length) {
                    spaceThroughContent();
                }
            },
        },
        pageUp: {
            title: L("PAGE_UP"),
            fn: () => scrollArticles((el) => el.scrollBy(0, -el.clientHeight * 0.85)),
        },
        pageDown: {
            title: L("PAGE_DOWN"),
            fn: () => scrollArticles((el) => el.scrollBy(0, el.clientHeight * 0.85)),
        },
        scrollToBottom: {
            title: L("SCROLL_TO_BOTTOM"),
            fn: () => scrollArticles((el) => (el.scrollTop = el.scrollHeight)),
        },
        scrollToTop: {
            title: L("SCROLL_TO_TOP"),
            fn: () => scrollArticles((el) => (el.scrollTop = 0)),
        },
    },

    content: {
        changeView: {
            title: L("CHANGE_VIEW"),
            icon: "newspaper",
            fn: () => {
                if (!contentArticle()) {
                    return;
                }
                uiStore.setState({
                    contentMode: ui().contentMode === "mozilla" ? "feed" : "mozilla",
                });
            },
        },
        mark: {
            title: L("MARK_AS_READ"),
            icon: "circle-check",
            fn: () => {
                const item = contentArticle();
                if (item) {
                    updateRecords("items", [item.id], { unread: !item.unread, visited: true });
                }
            },
        },
        undelete: {
            title: L("UNDELETE"),
            icon: "undo",
            fn: () => {
                const item = contentArticle();
                if (item?.trashed) {
                    updateRecords("items", [item.id], { trashed: false });
                }
            },
        },
        delete: {
            title: () => (contentArticle()?.trashed ? L("DELETE_PERMANENTLY") : L("DELETE")),
            icon: "trash",
            fn: (event) => {
                const item = contentArticle();
                if (!item) {
                    return;
                }
                const askRmPinned = settings.get("enablePin")
                    ? settings.get("askRmPinned")
                    : "none";
                const confirmPinned = () =>
                    !item.pinned ||
                    !askRmPinned ||
                    askRmPinned === "none" ||
                    confirm(translate("PINNED_DELETE_CONFIRM", { title: item.title }));

                if (item.trashed || event?.shiftKey) {
                    if (item.trashed && !confirm(L("REMOVE_SELECTED_PERMANENTLY"))) {
                        return;
                    }
                    if (!confirmPinned()) {
                        return;
                    }
                    commands.deleteContentArticlePermanently();
                    return;
                }
                if (askRmPinned === "all" && !confirmPinned()) {
                    return;
                }
                commands.trashContentArticle();
            },
        },
        showConfig: {
            title: L("SETTINGS"),
            icon: "settings",
            fn: async () => {
                const url = browser.runtime.getURL("options.html");
                const tabs = await browser.tabs.query({ url });
                if (!tabs[0]) {
                    await browser.tabs.create({ url });
                    return;
                }
                if (tabs[0].active) {
                    await browser.tabs.remove(tabs[0].id);
                    return;
                }
                await browser.tabs.update(tabs[0].id, { active: true });
            },
        },
        toggleTheme: {
            title: L("TOGGLE_THEME"),
            icon: () =>
                resolveTheme(settings.get("theme"), prefersDarkScheme()) === "dark"
                    ? "moon"
                    : "sun",
            fn: () =>
                settings.save("theme", toggledTheme(settings.get("theme"), prefersDarkScheme())),
        },
        focus: {
            title: L("FOCUS_CONTENT"),
            fn: () => setFocus("content"),
        },
        focusSandbox: {
            title: L("FOCUS_ARTICLE"),
            fn: () => contentFrame()?.focus(),
        },
        scrollDown: {
            title: L("SCROLL_DOWN"),
            fn: () => scrollFrame(0, 40),
        },
        scrollUp: {
            title: L("SCROLL_UP"),
            fn: () => scrollFrame(0, -40),
        },
        spaceThrough: {
            title: L("SPACE_THROUGH"),
            fn: () => spaceThroughContent(),
        },
        pageUp: {
            title: L("PAGE_UP"),
            fn: () => {
                const frame = contentFrame();
                if (frame?.contentWindow) {
                    scrollFrame(0, -frame.contentDocument.documentElement.clientHeight * 0.85);
                }
            },
        },
        pageDown: {
            title: L("PAGE_DOWN"),
            fn: () => {
                const frame = contentFrame();
                if (frame?.contentWindow) {
                    scrollFrame(0, frame.contentDocument.documentElement.clientHeight * 0.85);
                }
            },
        },
        scrollToBottom: {
            title: L("SCROLL_TO_BOTTOM"),
            fn: () => {
                const frame = contentFrame();
                frame?.contentWindow?.scrollTo(
                    0,
                    frame.contentDocument.documentElement.offsetHeight
                );
            },
        },
        scrollToTop: {
            title: L("SCROLL_TO_TOP"),
            fn: () => contentFrame()?.contentWindow?.scrollTo(0, 0),
        },
    },
};

function scrollArticles(apply: (element: HTMLElement) => void): void {
    const list = document.querySelector<HTMLElement>("#article-list");
    if (list) {
        apply(list);
    }
}

/** Page down through the article, then move to the next unread one. */
export function spaceThroughContent(): void {
    const pane = document.querySelector<HTMLElement>("#content");
    if (!pane) {
        return;
    }
    if (pane.offsetHeight + pane.scrollTop >= pane.scrollHeight) {
        commands.changeUnreadState({ onlyToRead: true });
        commands.selectArticleSibling(1, { selectUnread: true });
        setFocus("content");
        return;
    }
    pane.scrollBy(0, pane.offsetHeight * 0.85);
}

export function getAction(name: string): ActionDefinition | undefined {
    const [region, action] = name.split(":");
    return actions[region]?.[action];
}

export function actionTitle(name: string): string {
    const action = getAction(name);
    if (!action) {
        return name;
    }
    return typeof action.title === "function" ? action.title() : action.title;
}

export function actionIcon(name: string): string | undefined {
    const action = getAction(name);
    const icon = action?.icon;
    return typeof icon === "function" ? icon() : icon;
}

export function executeAction(name: string, event?: unknown): boolean {
    const action = getAction(name);
    if (!action) {
        return false;
    }
    void action.fn(event);
    return true;
}
