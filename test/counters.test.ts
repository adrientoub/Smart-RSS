import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    computeCounters,
    computeSourceCounts,
    computeFolderCounts,
    computeCounts,
} from "../src/scripts/shared/counters.ts";

const item = (attrs: Record<string, unknown> = {}) =>
    ({
        trashed: false,
        deleted: false,
        unread: false,
        visited: true,
        pinned: false,
        sourceID: "s1",
        ...attrs,
    }) as never;

describe("computeCounters", () => {
    it("counts live, trashed and pinned articles separately", () => {
        const counters = computeCounters([
            item({ unread: true }),
            item({ unread: true, pinned: true }),
            item({ pinned: true }),
            item({ trashed: true, unread: true }),
            item({ trashed: true }),
            item({ deleted: true }),
        ]);

        assert.equal(counters.allCountUnread, 2);
        assert.equal(counters.allCountTotal, 3);
        assert.equal(counters.trashCountUnread, 1);
        assert.equal(counters.trashCountTotal, 2);
        assert.equal(counters.pinnedCountUnread, 1);
        assert.equal(counters.pinnedCountTotal, 2);
    });

    /**
     * Known quirk carried over from Info.js: every other counter excludes
     * deleted articles, this one does not.
     */
    it("counts unvisited without excluding deleted", () => {
        const counters = computeCounters([
            item({ visited: false }),
            item({ visited: false, deleted: true }),
            item({ visited: false, trashed: true }),
        ]);

        assert.equal(counters.allCountUnvisited, 2);
    });

    it("returns zeroes for no items", () => {
        assert.deepEqual(computeCounters([]), {
            allCountUnread: 0,
            allCountTotal: 0,
            allCountUnvisited: 0,
            trashCountUnread: 0,
            trashCountTotal: 0,
            pinnedCountUnread: 0,
            pinnedCountTotal: 0,
        });
    });
});

describe("computeSourceCounts", () => {
    it("groups unread and total by source, ignoring trashed", () => {
        const counts = computeSourceCounts([
            item({ sourceID: "a", unread: true }),
            item({ sourceID: "a" }),
            item({ sourceID: "b", unread: true }),
            item({ sourceID: "b", trashed: true, unread: true }),
        ]);

        assert.deepEqual(counts.get("a"), [1, 2]);
        assert.deepEqual(counts.get("b"), [1, 1]);
    });
});

describe("computeFolderCounts", () => {
    it("sums the counts of the sources a folder holds", () => {
        const bySource = new Map<string, [number, number]>([
            ["a", [1, 2]],
            ["b", [1, 1]],
            ["c", [0, 5]],
        ]);
        const counts = computeFolderCounts(
            [
                { id: "a", folderID: "f1" },
                { id: "b", folderID: "f1" },
                { id: "c", folderID: "0" },
            ],
            bySource
        );

        assert.deepEqual(counts.get("f1"), [2, 3]);
        assert.equal(counts.has("0"), false);
    });
});

describe("computeCounts", () => {
    it("gives an empty folder a zero entry rather than none", () => {
        const counts = computeCounts({
            items: [],
            sources: [],
            folders: [{ id: "f1" }],
        });

        assert.deepEqual(counts.byFolder.get("f1"), [0, 0]);
        assert.equal(counts.counters.allCountTotal, 0);
    });
});
