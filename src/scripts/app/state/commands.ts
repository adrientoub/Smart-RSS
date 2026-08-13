/**
 * The reader's imperative operations.
 *
 * Everything the action table, the context menus and the components do to the
 * selection or to the data goes through here, so no component owns behaviour
 * another one needs.
 */
import { items, sources, folders } from "./data.ts";
import { ui, uiStore, setFocus, type ArticleQuery, type PropertiesTarget } from "./uiState.ts";
import { settings } from "./settings.ts";
import {
    feedRowOrder,
    feedRows,
    queryArticles,
    searchArticles,
    selectedArticles,
    selectedFolders,
    selectedSources,
    visibleArticles,
} from "./selectors.ts";
import { dropFromArticleList, rebuildArticleList } from "./articleList.ts";
import {
    selectId,
    selectAll as selectAllIds,
    type SelectionModifiers,
} from "../helpers/selection.ts";
import { findSiblingIndex } from "../helpers/listNavigation.ts";
import { specials, type SpecialName } from "../staticdb/specials.ts";
import {
    destroyRecords,
    idsOf,
    markItemsDeleted,
    trashItems,
    updateRecords,
} from "../../shared/dataClient.ts";
import { translate } from "../../shared/i18n.ts";
import type { FeedRow } from "../helpers/feedRows.ts";
import type { ItemRecord } from "../../shared/records.ts";

/* -------------------------------------------------------------------------- *
 * Feed list
 * -------------------------------------------------------------------------- */

export function selectFeedRow(
    key: string,
    modifiers: SelectionModifiers = {},
    forcePick = false
): boolean {
    const rows = feedRows();
    const { state, picked } = selectId(
        ui().feedSelection,
        feedRowOrder(rows),
        key,
        modifiers,
        forcePick
    );
    uiStore.setState({ feedSelection: state });
    return picked;
}

export function selectFeedSibling(direction: 1 | -1, event: SelectionModifiers = {}): void {
    const order = feedRowOrder();
    const last = ui().feedSelection.last;
    const from = last ? order.indexOf(last) : direction === 1 ? -1 : order.length;
    const circular =
        Boolean(settings.get("circularNavigation")) && !event.ctrlKey && !event.shiftKey;
    const index = findSiblingIndex(order.length, from, direction, () => true, circular);
    if (index < 0) {
        return;
    }
    selectFeedRow(order[index], event, true);
    uiStore.setState({ focusFeedKey: order[index] });
    showArticles();
}

export function toggleFolder(id: string, opened?: boolean): void {
    const folder = folders.get(id);
    if (!folder) {
        return;
    }
    updateRecords("folders", [id], { opened: opened ?? !folder.opened });
}

export function setAllFoldersOpen(opened: boolean): void {
    const ids = folders
        .all()
        .filter((folder) => folder.opened !== opened)
        .map((folder) => folder.id);
    if (ids.length) {
        updateRecords("folders", ids, { opened });
    }
}

export function focusFeed(id: string): void {
    const rows = feedRows();
    const row = rows.find((candidate) => candidate.id === id && candidate.kind !== "special");
    if (!row) {
        return;
    }
    // A feed inside a collapsed folder cannot be focused where it is.
    if (row.kind === "source" && row.folderID) {
        toggleFolder(row.folderID, true);
    }
    uiStore.setState({
        feedSelection: { selected: [row.key], pivot: row.key, last: row.key },
        focusFeedKey: row.key,
    });
    showArticles();
    setFocus("articles");
}

export function selectAllFeedsSpecial(): void {
    const key = "special:all-feeds";
    if (!feedRowOrder().includes(key)) {
        return;
    }
    uiStore.setState({ feedSelection: { selected: [key], pivot: key, last: key } });
    showArticles();
}

/** Builds the article query from the current feed selection. */
export function buildQuery(
    rows: readonly FeedRow[],
    altKey = false,
    byCounter = false
): ArticleQuery {
    const selectedKeys = new Set(ui().feedSelection.selected);
    const selectedRows = rows.filter((row) => selectedKeys.has(row.key));
    const special = selectedRows.find((row) => row.kind === "special");
    const folder = selectedRows.find((row) => row.kind === "folder");
    const feeds = selectedSources(rows).map((source) => source.id);

    let unreadOnly = Boolean(
        settings.get("defaultToUnreadOnly") || settings.get("showOnlyUnreadSources")
    );
    if (altKey || byCounter) {
        unreadOnly = !unreadOnly;
    }

    const definition = special ? specials[special.id as SpecialName] : null;
    return {
        feeds,
        filter: definition ? { ...definition.filter } : null,
        name: definition ? definition.name : null,
        multiple: Boolean(special || folder),
        unreadOnly,
    };
}

export function showArticles(
    event: { altKey?: boolean; target?: unknown } & SelectionModifiers = {}
): void {
    const rows = feedRows();
    const target = event.target as HTMLElement | undefined;
    const byCounter = target?.className === "source-counter";
    const query = buildQuery(rows, Boolean(event.altKey), byCounter);

    uiStore.setState({
        query,
        search: "",
        articleSelection: { selected: [], pivot: null, last: null },
        contentId: null,
        contentMode: "",
    });
    rebuildArticleList(query);

    // Selecting a feed acknowledges its "has new articles" marker.
    const flagged =
        query.name === "all-feeds"
            ? sources.where({ hasNew: true })
            : sources.where({ hasNew: true }).filter((source) => query.feeds.includes(source.id));
    updateRecords("sources", idsOf(flagged), { hasNew: false });

    selectFirstArticle();
}

export function showAndFocusArticles(event: SelectionModifiers = {}): void {
    if (!ui().feedSelection.selected.length) {
        return;
    }
    showArticles(event);
    setFocus("articles");
}

/* -------------------------------------------------------------------------- *
 * Article list
 * -------------------------------------------------------------------------- */

function articleOrder(): string[] {
    return visibleArticles().map((item) => item.id);
}

export function selectArticle(
    id: string,
    modifiers: SelectionModifiers = {},
    forcePick = false
): void {
    const { state, picked } = selectId(
        ui().articleSelection,
        articleOrder(),
        id,
        modifiers,
        forcePick
    );
    uiStore.setState({ articleSelection: state });
    if (picked) {
        openArticle(id);
    }
}

/** Shows an article and records that it was read. */
export function openArticle(id: string): void {
    const item = items.get(id);
    if (!item) {
        return;
    }
    uiStore.setState({ contentId: id, contentMode: "" });

    if (item.unread && settings.get("readOnVisit")) {
        updateRecords("items", [id], { visited: true, unread: false });
    } else if (!item.visited) {
        updateRecords("items", [id], { visited: true });
    }
}

export function selectFirstArticle(): void {
    if (!settings.get("selectFirstArticle")) {
        return;
    }
    const order = articleOrder();
    if (!order.length) {
        return;
    }
    uiStore.setState({
        articleSelection: { selected: [order[0]], pivot: order[0], last: order[0] },
    });
    openArticle(order[0]);
}

export interface SiblingOptions extends SelectionModifiers {
    selectUnread?: boolean;
    currentIsRemoved?: boolean;
}

export function selectArticleSibling(direction: 1 | -1, event: SiblingOptions = {}): void {
    const articles = visibleArticles();
    const order = articles.map((item) => item.id);
    const selection = ui().articleSelection;
    const anchorId = event.selectUnread && selection.pivot ? selection.pivot : selection.last;
    const anchor = anchorId ? order.indexOf(anchorId) : -1;
    const from = anchor < 0 ? (direction === 1 ? -1 : order.length) : anchor;

    const isSelectable = event.selectUnread
        ? (index: number) => articles[index].unread === true
        : () => true;
    const circular =
        Boolean(settings.get("circularNavigation")) && !event.ctrlKey && !event.shiftKey;

    let index = findSiblingIndex(order.length, from, direction, isSelectable, circular);
    if (index >= 0 && event.currentIsRemoved && order[index] === selection.last) {
        index = -1;
    }
    if (index < 0) {
        if (event.currentIsRemoved) {
            uiStore.setState({ contentId: null });
        }
        return;
    }

    selectArticle(order[index], event, true);
    uiStore.setState({ focusArticleId: order[index] });
}

export function selectAllArticles(): void {
    uiStore.setState({ articleSelection: selectAllIds(articleOrder()) });
}

export function setSearch(search: string): void {
    uiStore.setState({ search });
}

/** Moves the selection off rows that are about to disappear. */
function selectAfterRemoval(removed: readonly string[]): void {
    const order = articleOrder();
    const gone = new Set(removed);
    const lastIndex = order.findIndex((id) => gone.has(id));
    const remaining = order.filter((id) => !gone.has(id));
    if (!remaining.length) {
        uiStore.setState({
            articleSelection: { selected: [], pivot: null, last: null },
            contentId: null,
        });
        return;
    }
    const next = remaining[Math.min(Math.max(lastIndex, 0), remaining.length - 1)];
    uiStore.setState({ articleSelection: { selected: [next], pivot: next, last: next } });
    openArticle(next);
}

function confirmPinnedRemoval(articles: readonly ItemRecord[], mode: string): boolean {
    if (mode === "none") {
        return true;
    }
    const pinned = articles.filter((item) => item.pinned);
    return pinned.every((item) =>
        confirm(translate("PINNED_DELETE_CONFIRM", { title: item.title }))
    );
}

export function trashSelectedArticles(): void {
    const targets = selectedArticles();
    if (!targets.length) {
        return;
    }
    const askRmPinned = settings.get("enablePin") ? settings.get("askRmPinned") : "none";
    if (askRmPinned === "all" && !confirmPinnedRemoval(targets, "all")) {
        return;
    }
    const ids = idsOf(targets);
    selectAfterRemoval(ids);
    trashItems(ids);
}

export function deleteSelectedArticlesPermanently(): void {
    const targets = selectedArticles();
    if (!targets.length) {
        return;
    }
    const askRmPinned = settings.get("enablePin") ? settings.get("askRmPinned") : "none";
    if (!confirmPinnedRemoval(targets, String(askRmPinned))) {
        return;
    }
    const ids = idsOf(targets);
    selectAfterRemoval(ids);
    markItemsDeleted(ids);
}

export function undeleteSelectedArticles(): void {
    const targets = selectedArticles();
    if (!targets.length || ui().query.name !== "trash") {
        return;
    }
    const ids = idsOf(targets);
    selectAfterRemoval(ids);
    // Restoring does not change `trashed` in a way the list watches for.
    dropFromArticleList(ids);
    updateRecords("items", ids, { trashed: false });
}

export function changeUnreadState(options: { onlyToRead?: boolean } = {}): void {
    const selected = selectedArticles();
    if (!selected.length) {
        return;
    }
    const unread = options.onlyToRead ? false : !selected[0].unread;
    const targets = options.onlyToRead ? selected.filter((item) => item.unread) : selected;
    updateRecords("items", idsOf(targets), { unread, visited: true });
}

export function togglePinned(): void {
    if (!settings.get("enablePin")) {
        return;
    }
    const selected = selectedArticles();
    if (!selected.length) {
        return;
    }
    updateRecords("items", idsOf(selected), { pinned: !selected[0].pinned });
}

export function markQueryAsRead(): void {
    const query = ui().query;
    const read = { unread: false, visited: true };

    if (query.feeds.length) {
        const feeds = new Set(query.feeds);
        const unread = queryArticles(query).filter(
            (item) => item.unread && feeds.has(String(item.sourceID))
        );
        updateRecords("items", idsOf(unread), read);
        return;
    }
    if (query.name === "all-feeds") {
        if (!confirm(translate("MARK_ALL_QUESTION"))) {
            return;
        }
        updateRecords("items", idsOf(items.filter((item) => item.unread)), read);
        return;
    }
    if (query.filter) {
        updateRecords("items", idsOf(queryArticles(query).filter((item) => item.unread)), read);
    }
}

/* -------------------------------------------------------------------------- *
 * Feeds
 * -------------------------------------------------------------------------- */

export function markSelectedFeedsAsRead(): void {
    const selected = selectedSources();
    if (!selected.length) {
        return;
    }
    const ids = new Set(selected.map((source) => source.id));
    const unread = items.filter((item) => item.unread && ids.has(String(item.sourceID)));
    updateRecords("items", idsOf(unread), { unread: false, visited: true });

    const flagged = selected.filter((source) => source.hasNew);
    updateRecords("sources", idsOf(flagged), { hasNew: false });
}

export function deleteSelectedFeeds(): void {
    if (!confirm(translate("REALLY_DELETE"))) {
        return;
    }
    const feeds = selectedSources();
    const selectedFolderRecords = selectedFolders();
    // Articles of a deleted feed have nowhere to belong.
    const orphaned = items.filter((item) =>
        feeds.some((source) => source.id === String(item.sourceID))
    );
    destroyRecords("items", idsOf(orphaned));
    destroyRecords("sources", idsOf(feeds));
    destroyRecords("folders", idsOf(selectedFolderRecords));
    uiStore.setState({ feedSelection: { selected: [], pivot: null, last: null } });
    selectAllFeedsSpecial();
}

export function showProperties(): void {
    const rows = feedRows();
    const feeds = selectedSources(rows);
    const selectedFolderRecords = selectedFolders(rows);

    let properties: PropertiesTarget | null = null;
    if (ui().feedSelection.selected.length === 1 && selectedFolderRecords.length === 1) {
        properties = { kind: "folder", id: selectedFolderRecords[0].id };
    } else if (!selectedFolderRecords.length && feeds.length === 1) {
        properties = { kind: "source", source: feeds[0] };
    } else if (feeds.length > 0) {
        properties = { kind: "sources", sources: feeds };
    }
    uiStore.setState({ properties });
}

/** Search re-runs whenever the visible articles change, so it needs no command. */
export function searchCurrent(): ItemRecord[] {
    return searchArticles(queryArticles(), ui().search);
}

export function trashContentArticle(): void {
    const id = ui().contentId;
    if (id) {
        selectAfterRemoval([id]);
        trashItems([id]);
    }
}

export function deleteContentArticlePermanently(): void {
    const id = ui().contentId;
    if (id) {
        selectAfterRemoval([id]);
        markItemsDeleted([id]);
    }
}
