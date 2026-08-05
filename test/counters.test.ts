import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    computeCounters,
    computeSourceCounts,
    applyCounts,
} from "../src/scripts/shared/counters.ts";

const item = (attrs: Record<string, unknown>) => ({
    get: (key: string) =>
        ({
            trashed: false,
            deleted: false,
            unread: false,
            visited: true,
            pinned: false,
            sourceID: "s1",
            ...attrs,
        })[key],
});

interface TestModel {
    id?: unknown;
    get(key: string): unknown;
    set?(update: Record<string, unknown>): void;
}

const collection = (models: TestModel[]) => ({
    toArray: () => models,
    where: (attrs: Record<string, unknown>) =>
        models.filter((model) =>
            Object.entries(attrs).every(([key, value]) => model.get(key) === value)
        ),
});

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

describe("applyCounts", () => {
    it("sets counts on sources and aggregates them into folders", () => {
        const makeModel = (attrs: Record<string, unknown>) => {
            const state = { ...attrs };
            return {
                id: attrs.id,
                state,
                get: (key: string) => state[key],
                set: (update: Record<string, unknown>) => Object.assign(state, update),
            };
        };
        const sources = [
            makeModel({ id: "a", folderID: "f1" }),
            makeModel({ id: "b", folderID: "f1" }),
            makeModel({ id: "c", folderID: "0" }),
        ];
        const folders = [makeModel({ id: "f1" })];

        applyCounts({
            items: collection([
                item({ sourceID: "a", unread: true }),
                item({ sourceID: "a" }),
                item({ sourceID: "b", unread: true }),
                item({ sourceID: "c" }),
            ]),
            sources: collection(sources),
            folders: collection(folders),
        });

        assert.equal(sources[0].get("count"), 1);
        assert.equal(sources[0].get("countAll"), 2);
        assert.equal(folders[0].get("count"), 2);
        assert.equal(folders[0].get("countAll"), 3);
    });

    it("zeroes a source with no items", () => {
        const source = {
            id: "a",
            state: {} as Record<string, unknown>,
            get(key: string) {
                return this.state[key];
            },
            set(update: Record<string, unknown>) {
                Object.assign(this.state, update);
            },
        };
        const collection = (models: TestModel[]) => ({ toArray: () => models, where: () => [] });

        applyCounts({
            items: collection([]),
            sources: collection([source]),
            folders: collection([]),
        });

        assert.equal(source.get("count"), 0);
        assert.equal(source.get("countAll"), 0);
    });
});
