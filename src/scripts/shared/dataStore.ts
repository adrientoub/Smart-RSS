/**
 * Builds and loads the persisted collections for whichever context asks.
 *
 * Both the background and the UI hold their own instances over the same
 * IndexedDB. Only the background writes; the UI's copy is kept current by
 * `data-changed` broadcasts.
 */
import Sources from "./collections/Sources.js";
import Items from "./collections/Items.js";
import Folders from "./collections/Folders.js";
import Toolbars from "./collections/Toolbars.js";
import { registerCollections, type CollectionRegistry } from "./collectionRegistry.ts";

export function createCollections(): CollectionRegistry {
    const created = {
        sources: new Sources(),
        items: new Items(),
        folders: new Folders(),
        toolbars: new Toolbars(),
    };
    registerCollections(created);
    return created;
}

/**
 * Sequential on purpose: folders and sources are referenced by the records that
 * follow them, and a failed store must not abort the rest.
 */
export async function fetchCollections(collections: CollectionRegistry): Promise<void> {
    for (const name of ["folders", "sources", "toolbars", "items"] as const) {
        try {
            await collections[name].fetch({ silent: true });
        } catch (error) {
            console.error(`Failed to load ${name}`, error);
        }
    }
}
