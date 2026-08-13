/**
 * The background's writable view of the record stores.
 *
 * Only this context builds repositories: it is the single writer, and every
 * other context mirrors it through `data-changed`.
 */
import { Repository } from "../../shared/repository.ts";
import { folders, items, sources } from "../../shared/stores.ts";
import type { FolderRecord, ItemRecord, SourceRecord } from "../../shared/records.ts";
import type { StoreName } from "../../shared/messages.ts";

export const itemRepository = new Repository<ItemRecord>(items, "items");
export const sourceRepository = new Repository<SourceRecord>(sources, "sources");
export const folderRepository = new Repository<FolderRecord>(folders, "folders");

export const repositories = {
    items: itemRepository,
    sources: sourceRepository,
    folders: folderRepository,
};

export function repositoryFor(store: StoreName) {
    const repository = repositories[store];
    if (!repository) {
        throw new Error(`Unknown store: ${store}`);
    }
    return repository;
}

export async function loadRepositories(): Promise<void> {
    // Sequential: folders and sources are referenced by what follows them, and a
    // failed store must not abort the rest.
    for (const store of ["folders", "sources", "items"] as const) {
        try {
            await repositories[store].load();
        } catch (error) {
            console.error(`Failed to load ${store}`, error);
        }
    }
}
