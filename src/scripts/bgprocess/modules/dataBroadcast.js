/**
 * Tells other contexts what changed, so their copy of a collection can follow.
 *
 * Changes are batched to the end of the current task: a feed download touches
 * hundreds of records, and one message per record would be far more expensive
 * than the write itself.
 */
import { broadcast } from "../../shared/messages.ts";

const STORES = ["sources", "items", "folders", "toolbars"];

/**
 * An added record carries the whole article, content included, and a mass
 * refresh coalesces many feeds into one batch. Unbounded, that message grows to
 * megabytes and fails to send, which looks exactly like articles going missing.
 */
export const MAX_RECORDS_PER_MESSAGE = 20;

export function chunk(list, size = MAX_RECORDS_PER_MESSAGE) {
    const chunks = [];
    for (let i = 0; i < list.length; i += size) {
        chunks.push(list.slice(i, i + size));
    }
    return chunks;
}

export function startDataBroadcast(collections) {
    for (const store of STORES) {
        watch(store, collections[store]);
    }
}

function watch(store, collection) {
    let pending = null;

    const flush = () => {
        const batch = pending;
        pending = null;

        chunk(batch.added).forEach((added) => broadcast("data-changed", { store, added }));
        chunk(batch.changed).forEach((changed) => broadcast("data-changed", { store, changed }));
        chunk(batch.removed).forEach((removed) => broadcast("data-changed", { store, removed }));
    };

    const queue = () => {
        if (!pending) {
            pending = { added: [], changed: [], removed: [] };
            setTimeout(flush, 0);
        }
        return pending;
    };

    collection.on("add", (model) => {
        queue().added.push(model.toJSON());
    });

    collection.on("change", (model) => {
        const attrs = model.changedAttributes();
        if (!attrs) {
            return;
        }
        queue().changed.push({ id: model.get("id"), attrs });
    });

    // `destroy` covers deletion; `remove` alone would also fire on a plain reset.
    collection.on("destroy", (model) => {
        queue().removed.push(model.get("id"));
    });
}
