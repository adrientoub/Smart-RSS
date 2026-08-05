/**
 * The write side of the data layer.
 *
 * The background is the only writer for the persisted collections: the feed
 * loader updates sources and items continuously, and Info derives counters from
 * them, so a second writer would need conflict resolution. The UI asks instead.
 */
import { collections } from "../../shared/collectionRegistry.ts";

function collection(store) {
    const target = collections[store];
    if (!target) {
        throw new Error(`Unknown store: ${store}`);
    }
    return target;
}

/** Models are dropped from the collection as they are handled, so resolve first. */
function resolve(target, ids) {
    return ids.map((id) => target.get(id)).filter(Boolean);
}

export const dataHandlers = {
    "data-create": ({ store, attrs }) => {
        // The IndexedDB adapter assigns the id synchronously, before the write lands.
        const model = collection(store).create(attrs, { wait: true });
        return { id: model.get("id") };
    },

    "data-update": ({ store, ids, attrs }) => {
        const target = collection(store);
        resolve(target, ids).forEach((model) => model.save(attrs));
    },

    "data-destroy": ({ store, ids }) => {
        const target = collection(store);
        resolve(target, ids).forEach((model) => model.destroy());
    },

    "items-trash": ({ ids }) => {
        resolve(collection("items"), ids).forEach((item) => item.trash());
    },

    "items-mark-deleted": ({ ids }) => {
        resolve(collection("items"), ids).forEach((item) => item.markAsDeleted());
    },
};
