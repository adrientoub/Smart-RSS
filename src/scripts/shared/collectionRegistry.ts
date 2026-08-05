/**
 * The collection instances for the current extension context.
 *
 * `Item.getSource()` needs the sources collection, but the collections import
 * the models, so it cannot import them back. The background page used to solve
 * this with a `window.sources` global, which does not exist in a service worker
 * or in a UI page that owns its own collections.
 *
 * Whoever constructs the collections registers them here once at startup.
 */
export interface CollectionRegistry {
    sources: any;
    items: any;
    folders: any;
    toolbars: any;
}

export const collections: CollectionRegistry = {
    sources: null,
    items: null,
    folders: null,
    toolbars: null,
};

export function registerCollections(registered: Partial<CollectionRegistry>): void {
    Object.assign(collections, registered);
}
