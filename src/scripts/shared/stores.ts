/**
 * The record stores for the current extension context.
 *
 * The background and the reader each run in their own bundle, so these
 * module-level singletons are per-context by construction. The background is
 * the only writer (see `repository.ts`); the reader keeps its copy current from
 * `data-changed` broadcasts.
 */
import { tableFor } from "./db.ts";
import { RecordStore, type HasId } from "./recordStore.ts";
import {
    folderDefaults,
    itemDefaults,
    sourceDefaults,
    type FolderRecord,
    type ItemRecord,
    type SourceRecord,
} from "./records.ts";
import type { StoreName } from "./messages.ts";

export const items = new RecordStore<ItemRecord>(itemDefaults);
export const sources = new RecordStore<SourceRecord>(sourceDefaults);
export const folders = new RecordStore<FolderRecord>(folderDefaults);

export interface Stores {
    sources: RecordStore<SourceRecord>;
    folders: RecordStore<FolderRecord>;
    items: RecordStore<ItemRecord>;
}

export const stores: Stores = { sources, folders, items };

/**
 * Load order matters: folders and sources are referenced by the records that
 * follow them, and a failed store must not abort the rest.
 */
export const STORE_NAMES: StoreName[] = ["folders", "sources", "items"];

export async function loadStores(target: Stores = stores): Promise<void> {
    for (const name of STORE_NAMES) {
        try {
            const records = await tableFor(name).toArray();
            (target[name] as RecordStore<HasId>).reset(records as unknown as HasId[]);
        } catch (error) {
            console.error(`Failed to load ${name}`, error);
        }
    }
    // A download interrupted by a restart would otherwise leave a feed spinning.
    target.sources.updateMany(
        target.sources.where({ isLoading: true }).map((source) => source.id),
        { isLoading: false }
    );
}
