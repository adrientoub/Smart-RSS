/**
 * Tells other contexts what changed, so their copy of a store can follow.
 *
 * Changes are batched to the end of the current task: a feed download touches
 * hundreds of records, and one message per record would be far more expensive
 * than the write itself.
 */
import { broadcast } from "../../shared/messages.ts";
import { stores } from "../../shared/stores.ts";
import type { StoreName } from "../../shared/messages.ts";
import type { HasId, RecordStore, StoreChange } from "../../shared/recordStore.ts";

/**
 * Flush order, not just the set of stores. An article rendered in a multi-feed
 * view looks its source up by id, so a source must reach the other side before
 * the articles that reference it.
 */
const STORES: StoreName[] = ["sources", "folders", "items"];

/**
 * An added record carries the whole article, content included, and a mass
 * refresh coalesces many feeds into one batch. Unbounded, that message grows to
 * megabytes and fails to send, which looks exactly like articles going missing.
 */
export const MAX_RECORDS_PER_MESSAGE = 20;

export function chunk<T>(list: T[], size = MAX_RECORDS_PER_MESSAGE): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < list.length; i += size) {
        chunks.push(list.slice(i, i + size));
    }
    return chunks;
}

interface PendingChange {
    added: Record<string, unknown>[];
    changed: { id: string; attrs: Record<string, unknown> }[];
    removed: string[];
}

export function startDataBroadcast(
    target: Partial<Record<StoreName, RecordStore<HasId>>> = stores
): () => void {
    // One queue for every store, so the flush order above is honoured. Separate
    // timers per store would race, and articles could land before their feed.
    let pending: Partial<Record<StoreName, PendingChange>> | null = null;

    const flush = () => {
        const batch = pending;
        pending = null;
        if (!batch) {
            return;
        }

        for (const store of STORES) {
            const changes = batch[store];
            if (!changes) {
                continue;
            }
            chunk(changes.added).forEach((added) => broadcast("data-changed", { store, added }));
            chunk(changes.changed).forEach((changed) =>
                broadcast("data-changed", { store, changed })
            );
            chunk(changes.removed).forEach((removed) =>
                broadcast("data-changed", { store, removed })
            );
        }
    };

    const queue = (store: StoreName): PendingChange => {
        if (!pending) {
            pending = {};
            setTimeout(flush, 0);
        }
        pending[store] ??= { added: [], changed: [], removed: [] };
        return pending[store];
    };

    const unsubscribes = STORES.map((store) => {
        const source = target[store];
        if (!source) {
            return () => {};
        }
        return source.subscribe((change: StoreChange<HasId>) => {
            // A reset is a full re-read; every context does its own.
            if (change.reset) {
                return;
            }
            const entry = queue(store);
            entry.added.push(...(change.added as unknown as Record<string, unknown>[]));
            for (const { id, attrs } of change.changed) {
                entry.changed.push({ id, attrs: attrs as Record<string, unknown> });
            }
            entry.removed.push(...change.removed.map((record) => record.id));
        });
    });

    return () => unsubscribes.forEach((stop) => stop());
}
