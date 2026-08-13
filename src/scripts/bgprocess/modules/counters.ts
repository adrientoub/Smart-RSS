/**
 * Derived article counters for the background.
 *
 * The old `Info` model kept these up to date with incremental arithmetic spread
 * across a dozen Backbone change handlers, which drifted whenever a case was
 * missed. Counting is O(items) and only runs once per task, so it is recomputed
 * from the item records instead.
 */
import animation from "./Animation.ts";
import { settingsStore } from "../../shared/settings.ts";
import { items, sources } from "../../shared/stores.ts";
import { computeCounters, computeSourceCounts, type Counters } from "../../shared/counters.ts";
import { sourceRepository } from "./repositories.ts";

const { action } = browser;
const settings = settingsStore();

let counters: Counters = computeCounters([]);
let scheduled: ReturnType<typeof setTimeout> | null = null;
let badgeTimeout: ReturnType<typeof setTimeout> | null = null;

export function currentCounters(): Counters {
    return counters;
}

function updateBadge(): void {
    if (badgeTimeout) {
        return;
    }
    badgeTimeout = setTimeout(() => {
        badgeTimeout = null;
        if (settings.get("badgeMode") === "disabled") {
            action.setBadgeText({ text: "" });
            return;
        }
        const value =
            settings.get("badgeMode") === "unread"
                ? counters.allCountUnread
                : counters.allCountUnvisited;
        action.setBadgeText({ text: value <= 0 ? "" : value > 99 ? "+" : String(value) });
        action.setBadgeBackgroundColor({ color: "#777" });
    });
}

/**
 * A feed keeps its "has new articles" marker until everything in it is read.
 * Nothing else clears it, so it is derived here alongside the counts.
 */
function clearStaleHasNew(bySource: Map<string, [number, number]>): void {
    const stale = sources
        .where({ hasNew: true })
        .filter((source) => (bySource.get(source.id)?.[0] ?? 0) === 0)
        .map((source) => source.id);
    if (stale.length) {
        sourceRepository.update(stale, { hasNew: false });
    }
}

export function refreshCounters(): void {
    const all = items.all();
    counters = computeCounters(all);
    clearStaleHasNew(computeSourceCounts(all));
    updateBadge();
    animation.handleIconChange();
}

function scheduleRefresh(): void {
    if (scheduled) {
        return;
    }
    scheduled = setTimeout(() => {
        scheduled = null;
        refreshCounters();
    }, 0);
}

export function startCounters(): void {
    items.subscribe(scheduleRefresh);
    sources.subscribe(scheduleRefresh);
    settings.on("change:badgeMode", updateBadge);
    settings.on("change:icon", () => animation.handleIconChange());
    refreshCounters();
}
