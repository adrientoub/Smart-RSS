import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFeedRows, visibleFeedRows } from "../src/scripts/app/helpers/feedRows.ts";

const specials = {
    "all-feeds": {
        name: "all-feeds",
        title: "All",
        icon: "rss",
        filter: {},
        position: "top",
        contextMenu: "allFeeds",
    },
    pinned: {
        name: "pinned",
        title: "Pinned",
        icon: "pin",
        filter: {},
        position: "bottom",
        contextMenu: null,
    },
    trash: {
        name: "trash",
        title: "Trash",
        icon: "trash",
        filter: {},
        position: "bottom",
        contextMenu: "trash",
    },
} as never;

const source = (id: string, title: string, folderID = "0") => ({ id, title, folderID }) as never;

const build = (overrides: Record<string, unknown> = {}) =>
    buildFeedRows({
        sources: [],
        folders: [],
        specials,
        bySource: new Map(),
        byFolder: new Map(),
        showAllFeeds: true,
        showPinned: false,
        showOnlyUnread: false,
        counters: { allCountUnread: 0, pinnedCountUnread: 0, trashCountTotal: 0 },
        ...overrides,
    } as never);

describe("buildFeedRows", () => {
    it("puts all-feeds first and trash last", () => {
        const rows = build({ sources: [source("a", "A")] });

        assert.equal(rows[0].key, "special:all-feeds");
        assert.equal(rows[rows.length - 1].key, "special:trash");
    });

    it("omits all-feeds and pinned when they are turned off", () => {
        const rows = build({ showAllFeeds: false, showPinned: false });

        assert.deepEqual(
            rows.map((row) => row.key),
            ["special:trash"]
        );
    });

    it("lists a folder's sources right after it, in title order", () => {
        const rows = build({
            folders: [{ id: "f1", title: "News", opened: true }] as never,
            sources: [source("b", "Beta", "f1"), source("a", "Alpha", "f1")],
        });

        assert.deepEqual(
            rows.map((row) => row.key),
            ["special:all-feeds", "folder:f1", "source:a", "source:b", "special:trash"]
        );
    });

    it("hides the sources of a closed folder without dropping them", () => {
        const rows = build({
            folders: [{ id: "f1", title: "News", opened: false }] as never,
            sources: [source("a", "Alpha", "f1")],
        });

        assert.equal(rows.find((row) => row.key === "source:a").hidden, true);
        assert.equal(
            visibleFeedRows(rows).some((row) => row.key === "source:a"),
            false
        );
    });

    it("keeps ungrouped sources after the folders", () => {
        const rows = build({
            folders: [{ id: "f1", title: "News", opened: true }] as never,
            sources: [source("a", "Alpha", "f1"), source("z", "Zulu")],
        });

        assert.deepEqual(
            rows.map((row) => row.key),
            ["special:all-feeds", "folder:f1", "source:a", "source:z", "special:trash"]
        );
    });

    it("carries the derived counts onto the rows", () => {
        const rows = build({
            sources: [source("a", "Alpha")],
            bySource: new Map([["a", [2, 5]]]),
        });

        const row = rows.find((entry) => entry.key === "source:a");
        assert.equal(row.count, 2);
        assert.equal(row.countAll, 5);
    });

    it("drops read feeds and folders when only unread are shown", () => {
        const rows = build({
            showOnlyUnread: true,
            folders: [
                { id: "f1", title: "Read", opened: true },
                { id: "f2", title: "Unread", opened: true },
            ] as never,
            sources: [source("a", "Alpha", "f1"), source("b", "Beta", "f2")],
            bySource: new Map([["b", [1, 1]]]),
            byFolder: new Map([["f2", [1, 1]]]),
        });

        assert.deepEqual(
            rows.map((row) => row.key),
            ["special:all-feeds", "folder:f2", "source:b", "special:trash"]
        );
    });
});
