/**
 * Applies a `data-changed` batch to a context's own collections.
 *
 * Uses `set`/`add`/`remove` only. None of those persist, which is what keeps the
 * background the single writer while every context still sees the change.
 */
import type { StoreName } from "./messages.ts";

export interface MirrorCollection {
    comparator?: unknown;
    get(id: string): { set(attrs: Record<string, unknown>): void } | undefined;
    add(
        records: Record<string, unknown>[],
        options?: { merge?: boolean; sort?: boolean }
    ): unknown;
    remove(model: unknown): unknown;
    sort(options?: { silent?: boolean }): unknown;
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

    if (change.added?.length) {
        // Backbone fires "sort" for every add that reorders, and the article
        // list rebuilds itself from scratch on it. One add, one silent sort.
        collection.add(change.added, { merge: true, sort: false });
        if (collection.comparator) {
            collection.sort({ silent: true });
        }
    }
    change.changed?.forEach(({ id, attrs }) => collection.get(id)?.set(attrs));
    change.removed?.forEach((id) => {
        const model = collection.get(id);
        if (model) {
            collection.remove(model);
        }
    });

    return true;
}
