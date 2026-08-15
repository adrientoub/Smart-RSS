/**
 * Derived views over the record stores and the UI state.
 *
 * These are the queries the old views ran against Backbone collections. They are
 * plain functions so the action table and context menus can use them too.
 */
import { folders, items, sources, countsStore } from "./data.ts";
import { ui, type ArticleQuery } from "./uiState.ts";
import { settings } from "./settings.ts";
import {
    buildFeedRows,
    visibleFeedRows,
    type FeedRow,
    type SourceRow,
} from "../helpers/feedRows.ts";
import { specials } from "../staticdb/specials.ts";
import { createItemComparator } from "../helpers/itemSort.ts";
import { escapeRegExp, stripDiacritics } from "../helpers/text.ts";
import { articlesMatchingQuery, listArticles } from "./articleList.ts";
import { type FolderRecord, type ItemRecord, type SourceRecord } from "../../shared/records.ts";

export function feedRows(): FeedRow[] {
    const { counts } = countsStore.getState();
    return buildFeedRows({
        sources: sources.all(),
        folders: folders.all(),
        specials,
        bySource: counts.bySource,
        byFolder: counts.byFolder,
        showAllFeeds: Boolean(settings.get("showAllFeeds")),
        showPinned: Boolean(settings.get("showPinned") && settings.get("enablePin")),
        showOnlyUnread: Boolean(settings.get("showOnlyUnreadSources")),
        counters: counts.counters,
    });
}

export function feedRowOrder(rows: readonly FeedRow[] = feedRows()): string[] {
    return visibleFeedRows(rows).map((row) => row.key);
}

export function selectedFeedRows(rows: readonly FeedRow[] = feedRows()): FeedRow[] {
    const selected = new Set(ui().feedSelection.selected);
    return rows.filter((row) => selected.has(row.key));
}

/** Selected feeds, with folders expanded into the sources they hold. */
export function selectedSources(rows?: readonly FeedRow[]): SourceRecord[] {
    const found: SourceRecord[] = [];
    const seen = new Set<string>();
    for (const row of selectedFeedRows(rows)) {
        if (row.kind === "source") {
            if (!seen.has(row.id)) {
                seen.add(row.id);
                found.push((row as SourceRow).source);
            }
            continue;
        }
        if (row.kind === "folder") {
            for (const source of sources.where({ folderID: row.id })) {
                if (!seen.has(source.id)) {
                    seen.add(source.id);
                    found.push(source);
                }
            }
        }
    }
    return found;
}

export function selectedFolders(rows?: readonly FeedRow[]): FolderRecord[] {
    return selectedFeedRows(rows)
        .filter((row) => row.kind === "folder")
        .map((row) => folders.get(row.id))
        .filter(Boolean);
}

export function sourcesInFolder(folderID: string): SourceRecord[] {
    return sources.where({ folderID });
}

/** The articles a query selects, before the search box narrows them. */
export function queryArticles(query: ArticleQuery = ui().query): ItemRecord[] {
    return articlesMatchingQuery(query)
        .filter((item) => !query.unreadOnly || item.unread)
        .sort(createItemComparator(settings));
}

/** Applies the search box. An empty query keeps everything. */
export function searchArticles(articles: ItemRecord[], search: string): ItemRecord[] {
    let query = search.trim();
    if (!query) {
        return articles;
    }
    let searchInContent = false;
    if (query[0] === ":") {
        query = query.replace(/^:/, "");
        searchInContent = true;
    }
    if (!query) {
        return articles;
    }
    const expression = new RegExp(escapeRegExp(query), "i");
    return articles.filter(
        (item) =>
            expression.test(stripDiacritics(item.title)) ||
            expression.test(stripDiacritics(item.author)) ||
            (searchInContent && expression.test(stripDiacritics(item.content)))
    );
}

export function visibleArticles(): ItemRecord[] {
    return searchArticles(listArticles(), ui().search);
}

export function selectedArticles(): ItemRecord[] {
    return ui()
        .articleSelection.selected.map((id) => items.get(id))
        .filter(Boolean);
}

export function contentArticle(): ItemRecord | null {
    const id = ui().contentId;
    return id ? (items.get(id) ?? null) : null;
}
