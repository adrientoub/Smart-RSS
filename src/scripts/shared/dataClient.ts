/**
 * The UI's write path. Every persisted change goes to the background, which is
 * the only writer; see shared/messages.ts.
 */
import { sendMessage, type StoreName } from "./messages.ts";
import type { HasId } from "./recordStore.ts";

/** Records cross the boundary as ids only. */
export function idsOf(records: readonly HasId[] | HasId): string[] {
    const list = Array.isArray(records) ? records : [records as HasId];
    return list.map((record) => String(record.id));
}

export function createRecord(
    store: StoreName,
    attrs: Record<string, unknown>
): Promise<{ id: string }> {
    return sendMessage("data-create", { store, attrs });
}

export function updateRecords(
    store: StoreName,
    ids: string[],
    attrs: Record<string, unknown>
): Promise<void> {
    if (!ids.length) {
        return Promise.resolve();
    }
    return sendMessage("data-update", { store, ids, attrs });
}

export function destroyRecords(store: StoreName, ids: string[]): Promise<void> {
    if (!ids.length) {
        return Promise.resolve();
    }
    return sendMessage("data-destroy", { store, ids });
}

export function trashItems(ids: string[]): Promise<void> {
    if (!ids.length) {
        return Promise.resolve();
    }
    return sendMessage("items-trash", { ids });
}

export function markItemsDeleted(ids: string[]): Promise<void> {
    if (!ids.length) {
        return Promise.resolve();
    }
    return sendMessage("items-mark-deleted", { ids });
}
