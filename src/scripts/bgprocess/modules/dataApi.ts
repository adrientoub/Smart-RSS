/**
 * The write side of the data layer.
 *
 * The background is the only writer for the persisted stores: the feed loader
 * updates sources and items continuously, so a second writer would need
 * conflict resolution. The UI asks instead.
 */
import { itemRepository, repositoryFor } from "./repositories.ts";
import { markDeletedAttrs, trashedAttrs, type ItemRecord } from "../../shared/records.ts";
import type { StoreName } from "../../shared/messages.ts";

export const dataHandlers = {
    "data-create": ({ store, attrs }: { store: StoreName; attrs: Record<string, unknown> }) => {
        // The id is assigned synchronously, before the write lands.
        const record = repositoryFor(store).create(attrs as never);
        return { id: record.id };
    },

    "data-update": ({
        store,
        ids,
        attrs,
    }: {
        store: StoreName;
        ids: string[];
        attrs: Record<string, unknown>;
    }) => {
        repositoryFor(store).update(ids, attrs as never);
    },

    "data-destroy": ({ store, ids }: { store: StoreName; ids: string[] }) => {
        repositoryFor(store).remove(ids);
    },

    "items-trash": ({ ids }: { ids: string[] }) => {
        itemRepository.update(ids, trashedAttrs() as Partial<ItemRecord>);
    },

    "items-mark-deleted": ({ ids }: { ids: string[] }) => {
        itemRepository.update(ids, markDeletedAttrs() as Partial<ItemRecord>);
    },
};
