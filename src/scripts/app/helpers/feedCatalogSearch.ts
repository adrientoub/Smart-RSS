import type { CatalogCategory, CatalogFeed } from "../staticdb/feedCatalog.ts";
import { escapeRegExp, stripDiacritics } from "./text.ts";

export interface CatalogFilter {
    search?: string;
    /** `null` keeps every category. */
    category?: CatalogCategory | null;
}

/** Narrows the marketplace list by category and by a free-text query. */
export function filterCatalog(
    feeds: readonly CatalogFeed[],
    { search = "", category = null }: CatalogFilter = {}
): CatalogFeed[] {
    const query = search.trim();
    const expression = query ? new RegExp(escapeRegExp(stripDiacritics(query)), "i") : null;
    return feeds.filter((feed) => {
        if (category && feed.category !== category) {
            return false;
        }
        if (!expression) {
            return true;
        }
        return (
            expression.test(stripDiacritics(feed.title)) ||
            expression.test(stripDiacritics(feed.description)) ||
            expression.test(stripDiacritics(feed.site))
        );
    });
}
