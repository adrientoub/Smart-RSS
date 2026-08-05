/**
 * Applies a `data-changed` batch to a context's own collections.
 *
 * Uses `set`/`add`/`remove` only. None of those persist, which is what keeps the
 * background the single writer while every context still sees the change.
 */
import type { StoreName } from "./messages.ts";

export interface MirrorCollection {
    get(id: string): { set(attrs: Record<string, unknown>): void } | undefined;
    add(record: Record<string, unknown>, options?: { merge?: boolean }): unknown;
    remove(model: unknown): unknown;
}

export interface DataChange {
    store: StoreName;
    added?: Record<string, unknown>[];
    changed?: { id: string; attrs: Record<string, unknown> }[];
    removed?: string[];
}

export function applyDataChange(
    collections: Partial<Record<StoreName, MirrorCollection>>,
    change: DataChange
): boolean {
    const collection = collections[change.store];
    if (!collection) {
        return false;
    }

    change.added?.forEach((record) => collection.add(record, { merge: true }));
    change.changed?.forEach(({ id, attrs }) => collection.get(id)?.set(attrs));
    change.removed?.forEach((id) => {
        const model = collection.get(id);
        if (model) {
            collection.remove(model);
        }
    });

    return true;
}
