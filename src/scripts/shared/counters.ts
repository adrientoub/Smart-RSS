/**
 * Article counters, derived purely from the items collection so the badge and
 * the reader's special views can compute them independently.
 */

export interface CountableItem {
    get(key: string): unknown;
}

export interface Counters {
    allCountUnread: number;
    allCountTotal: number;
    allCountUnvisited: number;
    trashCountUnread: number;
    trashCountTotal: number;
    pinnedCountUnread: number;
    pinnedCountTotal: number;
}

const alive = (item: CountableItem) =>
    item.get("trashed") === false && item.get("deleted") === false;

export function computeCounters(items: CountableItem[]): Counters {
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
        const unread = item.get("unread") === true;
        const pinned = item.get("pinned") === true;

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
        if (item.get("visited") === false && item.get("trashed") === false) {
            counters.allCountUnvisited += 1;
        }

        if (item.get("trashed") === true && item.get("deleted") === false) {
            counters.trashCountTotal += 1;
            if (unread) {
                counters.trashCountUnread += 1;
            }
        }
    }

    return counters;
}

/** Per-source unread/total, keyed by source id. */
export function computeSourceCounts(items: CountableItem[]): Map<string, [number, number]> {
    const counts = new Map<string, [number, number]>();
    for (const item of items) {
        if (item.get("trashed") !== false) {
            continue;
        }
        const sourceID = String(item.get("sourceID"));
        const entry = counts.get(sourceID) ?? [0, 0];
        entry[1] += 1;
        if (item.get("unread") === true) {
            entry[0] += 1;
        }
        counts.set(sourceID, entry);
    }
    return counts;
}

interface CountableCollection {
    toArray(): any[];
    where(attrs: Record<string, unknown>): any[];
}

/**
 * Writes the derived counts onto sources and folders.
 *
 * These are `set`, never saved: they are not persisted, so every context has to
 * derive them from its own items after loading.
 */
export function applyCounts(collections: {
    items: CountableCollection;
    sources: CountableCollection;
    folders: CountableCollection;
}): Counters {
    const items = collections.items.toArray();
    const perSource = computeSourceCounts(items);

    collections.sources.toArray().forEach((source) => {
        const [count, countAll] = perSource.get(String(source.id)) ?? [0, 0];
        source.set({ count, countAll });
    });

    collections.folders.toArray().forEach((folder) => {
        let count = 0;
        let countAll = 0;
        collections.sources.where({ folderID: folder.id }).forEach((source) => {
            count += source.get("count");
            countAll += source.get("countAll");
        });
        folder.set({ count, countAll });
    });

    return computeCounters(items);
}
