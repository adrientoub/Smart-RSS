/**
 * Tells other contexts what changed, so their copy of a collection can follow.
 *
 * Changes are batched to the end of the current task: a feed download touches
 * hundreds of records, and one message per record would be far more expensive
 * than the write itself.
 */
import { broadcast } from "../../shared/messages.ts";

/**
 * Flush order, not just the set of stores. An article rendered in a multi-feed
 * view looks its source up by id, so a source must reach the other side before
 * the articles that reference it.
 */
const STORES = ["sources", "folders", "toolbars", "items"];

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
    // One queue for every store, so the flush order above is honoured. Separate
    // timers per store would race, and articles could land before their feed.
    let pending = null;

    const flush = () => {
        const batch = pending;
        pending = null;

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

    const queue = (store) => {
        if (!pending) {
            pending = {};
            setTimeout(flush, 0);
        }
        pending[store] ??= { added: [], changed: [], removed: [] };
        return pending[store];
    };

    for (const store of STORES) {
        watch(store, collections[store], queue);
    }
}

function watch(store, collection, queue) {
    collection.on("add", (model) => {
        queue(store).added.push(model.toJSON());
    });

    collection.on("change", (model) => {
        const attrs = model.changedAttributes();
        if (!attrs) {
            return;
        }
        queue(store).changed.push({ id: model.get("id"), attrs });
    });

    // `destroy` covers deletion; `remove` alone would also fire on a plain reset.
    collection.on("destroy", (model) => {
        queue(store).removed.push(model.get("id"));
    });
}
