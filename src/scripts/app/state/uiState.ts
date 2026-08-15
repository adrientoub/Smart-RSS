/**
 * Everything the reader's UI remembers: what is selected, what is being shown,
 * which overlay is open.
 *
 * Held outside React because hotkeys, the action table and context menus all run
 * as plain functions.
 */
import type { ItemRecord, SourceRecord } from "../../shared/records.ts";
import { createStore } from "./store.ts";
import { emptySelection, type SelectionState } from "../helpers/selection.ts";

export type RegionName = "feeds" | "articles" | "content";

/** What the article list is currently showing. */
export interface ArticleQuery {
    /** Source ids; empty means the query is defined by `filter` alone. */
    feeds: string[];
    filter: Partial<ItemRecord> | null;
    /** Special name, when a special row is selected. */
    name: string | null;
    /** Whether the list spans more than one feed, which shows feed titles. */
    multiple: boolean;
    unreadOnly: boolean;
}

export const allFeedsQuery: ArticleQuery = {
    feeds: [],
    filter: { trashed: false },
    name: "all-feeds",
    multiple: true,
    unreadOnly: false,
};

export type PropertiesTarget =
    | { kind: "source"; source: SourceRecord }
    | { kind: "folder"; id: string }
    | { kind: "sources"; sources: SourceRecord[] };

export interface ContextMenuState {
    menu: string;
    x: number;
    y: number;
}

export interface UiState {
    feedSelection: SelectionState;
    query: ArticleQuery;
    search: string;
    articleSelection: SelectionState;
    /** The article shown in the content pane. */
    contentId: string | null;
    /** "" follows the feed's default view. */
    contentMode: "" | "feed" | "mozilla";
    properties: PropertiesTarget | null;
    /** Whether the feed marketplace overlay is showing. */
    marketplaceOpen: boolean;
    contextMenu: ContextMenuState | null;
    focusRegion: RegionName;
    /** Bumped to re-assert focus even when the region did not change. */
    focusTick: number;
    /** Article row to scroll to and focus once it is rendered. */
    focusArticleId: string | null;
    /** Feed row to focus once it is rendered. */
    focusFeedKey: string | null;
}

export const uiStore = createStore<UiState>({
    feedSelection: emptySelection,
    query: allFeedsQuery,
    search: "",
    articleSelection: emptySelection,
    contentId: null,
    contentMode: "",
    properties: null,
    marketplaceOpen: false,
    contextMenu: null,
    focusRegion: "feeds",
    focusTick: 0,
    focusArticleId: null,
    focusFeedKey: null,
});

export const ui = () => uiStore.getState();

export function setFocus(region: RegionName): void {
    uiStore.setState((state) => ({ focusRegion: region, focusTick: state.focusTick + 1 }));
}

export function hideOverlays(): void {
    uiStore.setState({ contextMenu: null, properties: null, marketplaceOpen: false });
}

export function showContextMenu(menu: string, x: number, y: number): void {
    uiStore.setState({ contextMenu: { menu, x, y } });
}
