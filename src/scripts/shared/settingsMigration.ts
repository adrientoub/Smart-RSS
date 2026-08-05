/**
 * One-time move of settings from IndexedDB into `browser.storage.local`.
 *
 * Settings used to live in the `settings-backbone` object store as a single
 * record keyed `settings-id`. This copies the values users already have, so an
 * upgrade does not silently reset every preference back to its default.
 *
 * Runs once, guarded by a flag, and never deletes the IndexedDB record: if the
 * migration turns out to be wrong it can be rerun by clearing the flag.
 */
import { SETTING_KEYS, type Settings } from "./settingsSchema.ts";
import type { SettingsStore, StorageArea } from "./settings.ts";

export const MIGRATION_FLAG = "settingsMigratedFromIndexedDb";

const DATABASE = "backbone-indexeddb";
const STORE = "settings-backbone";
const RECORD_ID = "settings-id";

/** Picks out the keys the schema knows about, ignoring anything stale. */
export function pickKnownSettings(record: Record<string, unknown>): Partial<Settings> {
    const known: Record<string, unknown> = {};
    for (const key of SETTING_KEYS) {
        if (key in record && record[key] !== undefined) {
            known[key] = record[key];
        }
    }
    return known as Partial<Settings>;
}

function readLegacyRecord(): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
        // No version: attach to whatever exists rather than triggering an upgrade.
        const request = self.indexedDB.open(DATABASE);

        request.onerror = () => resolve(null);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.close();
                resolve(null);
                return;
            }
            try {
                const read = db.transaction([STORE], "readonly").objectStore(STORE).get(RECORD_ID);
                read.onsuccess = () => {
                    db.close();
                    resolve((read.result as Record<string, unknown>) ?? null);
                };
                read.onerror = () => {
                    db.close();
                    resolve(null);
                };
            } catch {
                db.close();
                resolve(null);
            }
        };
    });
}

export async function migrateSettings(
    store: SettingsStore,
    area: StorageArea,
    readRecord: () => Promise<Record<string, unknown> | null> = readLegacyRecord
): Promise<{ migrated: boolean; count: number }> {
    const flag = await area.get(MIGRATION_FLAG);
    if (flag[MIGRATION_FLAG]) {
        return { migrated: false, count: 0 };
    }

    const record = await readRecord();
    const known = record ? pickKnownSettings(record) : {};
    const count = Object.keys(known).length;

    if (count > 0) {
        await store.setMany(known);
    }
    await area.set({ [MIGRATION_FLAG]: true });

    return { migrated: true, count };
}
