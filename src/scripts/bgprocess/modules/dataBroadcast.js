/**
 * Tells other contexts what changed, so their copy of a collection can follow.
 *
 * Changes are batched to the end of the current task: a feed download touches
 * hundreds of records, and one message per record would be far more expensive
 * than the write itself.
 */
import { broadcast } from "../../shared/messages.ts";

const STORES = ["sources", "items", "folders", "toolbars"];

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
        broadcast("data-changed", { store, ...batch });
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
