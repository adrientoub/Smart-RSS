/**
 * The reader's copy of the persisted records.
 *
 * The background is the only writer (see shared/dataClient.ts); everything here
 * is read-only and kept current by `data-changed`. Nothing in this module may
 * write to IndexedDB — a second writer is exactly what the design avoids.
 */
import { folders, items, sources, loadStores, stores } from "../../shared/stores.ts";
import { applyDataChange } from "../../shared/dataMirror.ts";
import { createChangeBuffer } from "../../shared/changeBuffer.ts";
import { handleMessages } from "../../shared/messages.ts";
import { computeCounts, type DerivedCounts } from "../../shared/counters.ts";
import { createStore } from "./store.ts";

export { folders, items, sources, stores };

/** Counters for the special rows and the feed list. Never persisted. */
export const countsStore = createStore<{ counts: DerivedCounts }>({
    counts: computeCounts({ items: [], sources: [] }),
});

let recount: ReturnType<typeof setTimeout> | null = null;

export function refreshCounts(): void {
    countsStore.setState({
        counts: computeCounts({
            items: items.values(),
            sources: sources.values(),
            folders: folders.values(),
        }),
    });
}

function scheduleRecount(): void {
    if (recount) {
        return;
    }
    recount = setTimeout(() => {
        recount = null;
        refreshCounts();
    }, 0);
}

function applyChange(change: Parameters<typeof applyDataChange>[1]): void {
    if (!applyDataChange(stores, change)) {
        return;
    }
    if (change.store === "items" || change.store === "sources") {
        scheduleRecount();
    }
}

/**
 * Applying a change renders, and nothing is mounted until `start()`. Until then
 * changes are held rather than dropped.
 */
const incoming = createChangeBuffer(applyChange);

export function startApplyingChanges(): void {
    incoming.start();
}

/**
 * `live` is off for the options page, which only needs a snapshot.
 */
export async function loadData({ live = true } = {}): Promise<void> {
    // Registered before the load so a write during it is not missed.
    if (live) {
        handleMessages({ "data-changed": (change) => incoming.push(change) });
    }
    await loadStores();
    refreshCounts();
}

/** Re-reads everything, for when an import writes to IndexedDB directly. */
export async function reloadData(): Promise<void> {
    await loadStores();
    refreshCounts();
}
