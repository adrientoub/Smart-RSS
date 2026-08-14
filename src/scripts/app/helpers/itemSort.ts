/**
 * Article ordering.
 *
 * The old `Items` collection carried this as a Backbone comparator and re-sorted
 * itself whenever a sort setting changed. Ordering is a presentation concern, so
 * the list sorts what it renders instead.
 */
import type { ItemRecord } from "../../shared/records.ts";
import type { SettingsStore } from "../../shared/settings.ts";

/**
 * Built once. `localeCompare` without a cached collator can rebuild collation
 * data on every call, and this runs O(N log N) times per sort.
 *
 * "base" sensitivity makes case and accents equivalent; "numeric" orders
 * Episode 9 before Episode 10.
 */
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function spaceship(a: unknown, b: unknown): number {
    if (typeof a === "string" || typeof b === "string") {
        return collator.compare(String(a), String(b));
    }
    if (a > b) {
        return 1;
    }
    if (a < b) {
        return -1;
    }
    return 0;
}

export type ItemComparator = (a: ItemRecord, b: ItemRecord) => number;

export function createItemComparator(settings: SettingsStore): ItemComparator {
    const primary = settings.get("sortBy") as keyof ItemRecord;
    const primaryDesc = settings.get("sortOrder") === "desc";
    const secondary = settings.get("sortBy2") as keyof ItemRecord;
    const secondaryDesc = settings.get("sortOrder2") === "desc";

    return (a, b) => {
        const first = spaceship(String(a[primary]), String(b[primary]));
        if (first !== 0) {
            return primaryDesc ? -first : first;
        }
        const second = spaceship(String(a[secondary]), String(b[secondary]));
        return secondaryDesc ? -second : second;
    };
}
