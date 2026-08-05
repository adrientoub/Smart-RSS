/**
 * The reader's own copy of the persisted collections.
 *
 * The background is the only writer (see shared/dataClient.ts); everything here
 * is read-only and kept current by `data-changed`. Nothing in this module may
 * call save/destroy/create — those persist, and a second writer is exactly what
 * the design avoids.
 */
import BB from "backbone";
import { createCollections, fetchCollections } from "../../shared/dataStore.ts";
import { applyCounts } from "../../shared/counters.ts";
import { applyDataChange } from "../../shared/dataMirror.ts";
import { createChangeBuffer } from "../../shared/changeBuffer.ts";
import { handleMessages } from "../../shared/messages.ts";

export const collections = createCollections();
export const { sources, items, folders, toolbars } = collections;

/** Counters for the special rows. Derived locally; they are never persisted. */
export const info = new BB.Model();

let recount = null;

/** Recomputes the derived counts. Needed after anything writes behind our back. */
export function refreshCounts() {
    info.set(applyCounts(collections));
}

function scheduleRecount() {
    if (recount) {
        return;
    }
    recount = setTimeout(() => {
        recount = null;
        refreshCounts();
    }, 0);
}

function applyChange(change) {
    if (!applyDataChange(collections, change)) {
        return;
    }
    if (change.store === "items" || change.store === "sources") {
        scheduleRecount();
    }
}

/**
 * Applying a change runs view code, and the views do not exist until
 * `app.start()`. Until then changes are held rather than dropped.
 */
const incoming = createChangeBuffer(applyChange);

export function startApplyingChanges() {
    incoming.start();
}

export async function loadData() {
    // Registered before the fetch so a write during it is not missed. Fetch
    // merges rather than resets, so an early change is not clobbered.
    handleMessages({ "data-changed": (change) => incoming.push(change) });
    await fetchCollections(collections);
    refreshCounts();
}

/** Re-reads everything, for when an import writes to IndexedDB directly. */
export async function reloadData() {
    await fetchCollections(collections);
    refreshCounts();
}
