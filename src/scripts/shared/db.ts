/**
 * The persisted store, backed by Dexie.
 *
 * This is a brand new database. Nothing is copied out of the old
 * `backbone-indexeddb`: upgrading users start empty.
 *
 * Booleans are not valid IndexedDB keys, so `unread`, `trashed`, `deleted` and
 * `pinned` cannot be indexed while they are stored as booleans — records with a
 * boolean value are silently left out of the index. Only key-typed fields are
 * declared below.
 */
import Dexie, { type Table } from "dexie";

export type StoreRecord = Record<string, unknown>;

export const DATABASE_NAME = "smart-rss";

const SCHEMA = {
    items: "id, sourceID, date, dateCreated, [sourceID+date]",
    sources: "id, folderID, url",
    folders: "id, title",
};

export type TableName = keyof typeof SCHEMA;

export const db = new Dexie(DATABASE_NAME);
db.version(1).stores(SCHEMA);

export function tableFor(name: string): Table<StoreRecord, string> {
    return db.table(name);
}
