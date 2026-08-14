/**
 * Which articles the list is showing.
 *
 * Membership is a snapshot taken when the query changes, not a live filter: an
 * article that is read while an unread-only list is open has to stay visible
 * until the list is rebuilt, or it would vanish from under the cursor the moment
 * it is opened. New articles are added as they arrive, and an article leaves
 * only when it is deleted or trashed out of scope.
 */
import { items } from "./data.ts";
import { ui, uiStore, type ArticleQuery } from "./uiState.ts";
import { settings } from "./settings.ts";
import { createItemComparator } from "../helpers/itemSort.ts";
import { matches, type ItemRecord } from "../../shared/records.ts";

let membership = new Set<string>();

/** Whether an article is in the query's scope, ignoring the unread filter. */
export function inQueryScope(item: ItemRecord, query: ArticleQuery): boolean {
    const inScope = query.filter ? matches(item, query.filter) : item.trashed === false;
    if (!inScope) {
        return false;
    }
    return query.name ? true : query.feeds.includes(String(item.sourceID));
}

/** Every article the query selects right now, ignoring the current membership. */
export function articlesMatchingQuery(query: ArticleQuery = ui().query): ItemRecord[] {
    return items.filter((item) => inQueryScope(item, query));
}

export function rebuildArticleList(query: ArticleQuery = ui().query): void {
    membership = new Set(
        articlesMatchingQuery(query)
            .filter((item) => !query.unreadOnly || item.unread)
            .map((item) => item.id)
    );
}

export function dropFromArticleList(ids: readonly string[]): void {
    ids.forEach((id) => membership.delete(id));
}

/** The list contents, in display order. */
export function listArticles(): ItemRecord[] {
    const articles: ItemRecord[] = [];
    for (const id of membership) {
        const item = items.get(id);
        if (item) {
            articles.push(item);
        }
    }
    return articles.sort(createItemComparator(settings));
}

/**
 * Keeps the membership current: new articles join, deleted or trashed ones
 * leave. A change of read state deliberately does not.
 */
export function startArticleList(): void {
    items.subscribe((change) => {
        const query = ui().query;
        if (change.reset) {
            rebuildArticleList(query);
            return;
        }
        for (const record of change.added) {
            if (inQueryScope(record, query)) {
                membership.add(record.id);
            }
        }
        for (const { record } of change.changed) {
            if (!membership.has(record.id)) {
                continue;
            }
            if (record.deleted || (query.name !== "trash" && record.trashed)) {
                membership.delete(record.id);
            }
        }
        for (const record of change.removed) {
            membership.delete(record.id);
        }
    });

    // The only setting that changes what belongs in the list.
    settings.on("change:defaultToUnreadOnly", () => {
        const query = ui().query;
        const unreadOnly = Boolean(settings.get("defaultToUnreadOnly"));
        if (query.unreadOnly !== unreadOnly) {
            uiStore.setState({ query: { ...query, unreadOnly } });
        }
        rebuildArticleList({ ...query, unreadOnly });
    });
}
