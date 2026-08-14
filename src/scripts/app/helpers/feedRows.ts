/**
 * The ordered feed-list rows: specials, folders, and the sources inside or
 * outside them.
 *
 * Kept free of the DOM so ordering, folder nesting and the "unread only" filter
 * can be tested directly. Selection and keyboard movement address rows by key.
 */
import type { FolderRecord, SourceRecord } from "../../shared/records.ts";
import type { CountPair } from "../../shared/counters.ts";
import { NO_COUNTS, type Counters } from "../../shared/counters.ts";
import type { Special, SpecialName } from "../staticdb/specials.ts";

export type FeedRowKind = "special" | "folder" | "source";

export interface FeedRowBase {
    key: string;
    kind: FeedRowKind;
    id: string;
    title: string;
    count: number;
    countAll: number;
    /** What the counter shows; the trash deliberately shows nothing. */
    badge: number;
    /** Hidden rows keep their place so a folder can be collapsed without a rebuild. */
    hidden: boolean;
}

export interface SpecialRow extends FeedRowBase {
    kind: "special";
    special: Special;
}

export interface FolderRow extends FeedRowBase {
    kind: "folder";
    folder: FolderRecord;
}

export interface SourceRow extends FeedRowBase {
    kind: "source";
    source: SourceRecord;
    folderID: string | null;
}

export type FeedRow = SpecialRow | FolderRow | SourceRow;

export const feedRowKey = (kind: FeedRowKind, id: string) => `${kind}:${id}`;

const byTitle = (a: { title?: string }, b: { title?: string }) =>
    (a.title || "")
        .trim()
        .toLowerCase()
        .localeCompare((b.title || "").trim().toLowerCase());

export interface FeedListInput {
    sources: readonly SourceRecord[];
    folders: readonly FolderRecord[];
    specials: Record<SpecialName, Special>;
    bySource: Map<string, CountPair>;
    byFolder: Map<string, CountPair>;
    showAllFeeds: boolean;
    showPinned: boolean;
    showOnlyUnread: boolean;
    counters: Counters;
}

export function buildFeedRows(input: FeedListInput): FeedRow[] {
    const rows: FeedRow[] = [];

    const specialRow = (
        name: SpecialName,
        count: number,
        countAll: number,
        badge = count
    ): SpecialRow => {
        const special = input.specials[name];
        return {
            key: feedRowKey("special", name),
            kind: "special",
            id: name,
            title: special.title,
            count,
            countAll,
            badge,
            hidden: false,
            special,
        };
    };

    if (input.showAllFeeds) {
        rows.push(
            specialRow(
                "all-feeds",
                input.counters.allCountUnread,
                input.counters.allCountTotal
            )
        );
    }

    const inFolder = new Map<string, SourceRecord[]>();
    const ungrouped: SourceRecord[] = [];
    for (const source of input.sources) {
        const folderID = source.folderID && source.folderID !== "0" ? source.folderID : null;
        if (folderID) {
            const list = inFolder.get(folderID) ?? [];
            list.push(source);
            inFolder.set(folderID, list);
            continue;
        }
        ungrouped.push(source);
    }

    const sourceRow = (source: SourceRecord, folderID: string | null, hidden: boolean) => {
        const [count, countAll] = input.bySource.get(source.id) ?? NO_COUNTS;
        return {
            key: feedRowKey("source", source.id),
            kind: "source" as const,
            id: source.id,
            title: source.title,
            count,
            countAll,
            badge: count,
            hidden,
            source,
            folderID,
        };
    };

    for (const folder of [...input.folders].sort(byTitle)) {
        const [count, countAll] = input.byFolder.get(folder.id) ?? NO_COUNTS;
        if (input.showOnlyUnread && count === 0) {
            continue;
        }
        rows.push({
            key: feedRowKey("folder", folder.id),
            kind: "folder",
            id: folder.id,
            title: folder.title,
            count,
            countAll,
            badge: count,
            hidden: false,
            folder,
        });
        for (const source of (inFolder.get(folder.id) ?? []).sort(byTitle)) {
            const row = sourceRow(source, folder.id, !folder.opened);
            if (input.showOnlyUnread && row.count === 0) {
                continue;
            }
            rows.push(row);
        }
    }

    for (const source of ungrouped.sort(byTitle)) {
        const row = sourceRow(source, null, false);
        if (input.showOnlyUnread && row.count === 0) {
            continue;
        }
        rows.push(row);
    }

    if (input.showPinned) {
        rows.push(
            specialRow(
                "pinned",
                input.counters.pinnedCountUnread,
                input.counters.pinnedCountTotal
            )
        );
    }
    rows.push(
        specialRow("trash", input.counters.trashCountUnread, input.counters.trashCountTotal, 0)
    );

    return rows;
}

/** Rows a user can move to with the keyboard, i.e. everything not collapsed. */
export function visibleFeedRows(rows: readonly FeedRow[]): FeedRow[] {
    return rows.filter((row) => !row.hidden);
}
