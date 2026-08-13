/**
 * The pseudo-feeds at the top and bottom of the feed list.
 *
 * Plain definitions: they used to be Backbone models purely so a view could
 * bind to them.
 */
import type { ItemRecord } from "../../shared/records.ts";
import { translate } from "../../shared/i18n.ts";

export type SpecialName = "all-feeds" | "pinned" | "trash";

export interface Special {
    name: SpecialName;
    title: string;
    icon: string;
    filter: Partial<ItemRecord>;
    position: "top" | "bottom";
    /** Which context menu the row opens, if any. */
    contextMenu: string | null;
}

export const specials: Record<SpecialName, Special> = {
    "all-feeds": {
        name: "all-feeds",
        title: translate("ALL_FEEDS"),
        icon: "rss",
        filter: { trashed: false },
        position: "top",
        contextMenu: "allFeeds",
    },
    pinned: {
        name: "pinned",
        title: translate("PINNED"),
        icon: "pin",
        filter: { trashed: false, pinned: true },
        position: "bottom",
        contextMenu: null,
    },
    trash: {
        name: "trash",
        title: translate("TRASH"),
        icon: "trash",
        filter: { trashed: true, deleted: false },
        position: "bottom",
        contextMenu: "trash",
    },
};

/** The trash icon reflects how full it is. */
export function trashIcon(total: number): string {
    if (total <= 0) {
        return "trash";
    }
    return total < 100 ? "trash-full" : "trash-overflow";
}
