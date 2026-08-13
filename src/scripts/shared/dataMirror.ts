/**
 * Applies a `data-changed` batch to a context's own record stores.
 *
 * Nothing here persists, which is what keeps the background the single writer
 * while every context still sees the change.
 */
import type { StoreName } from "./messages.ts";
import type { HasId, RecordStore } from "./recordStore.ts";

export interface DataChange {
    store: StoreName;
    added?: Record<string, unknown>[];
    changed?: { id: string; attrs: Record<string, unknown> }[];
    removed?: string[];
}

type AnyStore = RecordStore<HasId>;

export function applyDataChange(
    stores: Partial<Record<StoreName, AnyStore>>,
    change: DataChange
): boolean {
    const store = stores[change.store];
    if (!store) {
        return false;
    }

    if (change.added?.length) {
        store.add(change.added as unknown as (Partial<HasId> & HasId)[]);
    }
    if (change.changed?.length) {
        store.patch(change.changed as unknown as { id: string; attrs: Partial<HasId> }[]);
    }
    if (change.removed?.length) {
        store.remove(change.removed);
    }

    return true;
}
