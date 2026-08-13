/**
 * Article counters, derived purely from the item records so the badge and the
 * reader's special views can compute them independently.
 *
 * Counts are never persisted and never stored on a record: each context derives
 * them from its own copy of the items.
 */
import type { FolderRecord, ItemRecord, SourceRecord } from "./records.ts";

export interface Counters {
    allCountUnread: number;
    allCountTotal: number;
    allCountUnvisited: number;
    trashCountUnread: number;
    trashCountTotal: number;
    pinnedCountUnread: number;
    pinnedCountTotal: number;
}

/** Unread and total, in that order. */
export type CountPair = [number, number];

export const NO_COUNTS: CountPair = [0, 0];

export interface DerivedCounts {
    counters: Counters;
    bySource: Map<string, CountPair>;
    byFolder: Map<string, CountPair>;
}

type CountableItem = Pick<
    ItemRecord,
    "trashed" | "deleted" | "unread" | "visited" | "pinned" | "sourceID"
>;

const alive = (item: CountableItem) => item.trashed === false && item.deleted === false;

export function computeCounters(items: Iterable<CountableItem>): Counters {
    const counters: Counters = {
        allCountUnread: 0,
        allCountTotal: 0,
        allCountUnvisited: 0,
        trashCountUnread: 0,
        trashCountTotal: 0,
        pinnedCountUnread: 0,
        pinnedCountTotal: 0,
    };

    for (const item of items) {
        const unread = item.unread === true;
        const pinned = item.pinned === true;

        if (alive(item)) {
            counters.allCountTotal += 1;
            if (unread) {
                counters.allCountUnread += 1;
            }
            if (pinned) {
                counters.pinnedCountTotal += 1;
                if (unread) {
                    counters.pinnedCountUnread += 1;
                }
            }
        }

        // Deliberately not filtered on `deleted`, matching the original query.
        if (item.visited === false && item.trashed === false) {
            counters.allCountUnvisited += 1;
        }

        if (item.trashed === true && item.deleted === false) {
            counters.trashCountTotal += 1;
            if (unread) {
                counters.trashCountUnread += 1;
            }
        }
    }

    return counters;
}

/** Per-source unread/total, keyed by source id. */
export function computeSourceCounts(items: Iterable<CountableItem>): Map<string, CountPair> {
    const counts = new Map<string, CountPair>();
    for (const item of items) {
        if (item.trashed !== false) {
            continue;
        }
        const sourceID = String(item.sourceID);
        const entry = counts.get(sourceID) ?? [0, 0];
        entry[1] += 1;
        if (item.unread === true) {
            entry[0] += 1;
        }
        counts.set(sourceID, entry);
    }
    return counts;
}

/** Folder totals, summed from the sources each folder holds. */
export function computeFolderCounts(
    sources: Iterable<Pick<SourceRecord, "id" | "folderID">>,
    bySource: Map<string, CountPair>
): Map<string, CountPair> {
    const counts = new Map<string, CountPair>();
    for (const source of sources) {
        const folderID = String(source.folderID ?? "");
        if (!folderID || folderID === "0") {
            continue;
        }
        const [count, countAll] = bySource.get(String(source.id)) ?? NO_COUNTS;
        const entry = counts.get(folderID) ?? [0, 0];
        entry[0] += count;
        entry[1] += countAll;
        counts.set(folderID, entry);
    }
    return counts;
}

export function computeCounts(data: {
    items: Iterable<CountableItem>;
    sources: Iterable<Pick<SourceRecord, "id" | "folderID">>;
    folders?: Iterable<Pick<FolderRecord, "id">>;
}): DerivedCounts {
    const items = [...data.items];
    const bySource = computeSourceCounts(items);
    const byFolder = computeFolderCounts(data.sources, bySource);
    if (data.folders) {
        for (const folder of data.folders) {
            if (!byFolder.has(String(folder.id))) {
                byFolder.set(String(folder.id), [0, 0]);
            }
        }
    }
    return { counters: computeCounters(items), bySource, byFolder };
}
