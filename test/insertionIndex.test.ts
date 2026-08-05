import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findInsertionIndex } from "../src/scripts/app/helpers/insertionIndex.js";

/** Backbone comparators return 1 when the first argument sorts after the second. */
const byDate = (a: { date: number }, b: { date: number }) => {
    if (a.date > b.date) {
        return 1;
    }
    return a.date < b.date ? -1 : 0;
};

const views = (...dates: number[]) => dates.map((date) => ({ model: { date } }));

describe("findInsertionIndex", () => {
    it("returns 0 for an empty list", () => {
        assert.equal(findInsertionIndex([], { date: 5 }, byDate), 0);
    });

    it("appends when the item sorts last", () => {
        assert.equal(findInsertionIndex(views(1, 2, 3), { date: 9 }, byDate), 3);
    });

    it("prepends when the item sorts first", () => {
        assert.equal(findInsertionIndex(views(5, 6, 7), { date: 1 }, byDate), 0);
    });

    it("inserts before the first greater element", () => {
        assert.equal(findInsertionIndex(views(1, 3, 5, 7), { date: 4 }, byDate), 2);
    });

    /** Insert after existing equals, so a batch of equal dates keeps arrival order. */
    it("inserts after an equal element", () => {
        assert.equal(findInsertionIndex(views(1, 4, 4, 7), { date: 4 }, byDate), 3);
    });

    it("agrees with a linear scan over every position", () => {
        const sorted = views(10, 20, 30, 40, 50);
        for (const date of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]) {
            const expected = sorted.findIndex((view) => byDate(view.model, { date }) === 1);
            assert.equal(
                findInsertionIndex(sorted, { date }, byDate),
                expected === -1 ? sorted.length : expected,
                `for ${date}`
            );
        }
    });

    it("keeps the list sorted when inserting repeatedly", () => {
        const list: { model: { date: number } }[] = [];
        for (const date of [5, 1, 9, 3, 7, 1, 9]) {
            list.splice(findInsertionIndex(list, { date }, byDate), 0, { model: { date } });
        }

        assert.deepEqual(
            list.map((view) => view.model.date),
            [1, 1, 3, 5, 7, 9, 9]
        );
    });
});
