import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findSiblingIndex } from "../src/scripts/app/helpers/listNavigation.ts";

const anything = () => true;

describe("findSiblingIndex", () => {
    it("returns -1 for an empty list", () => {
        assert.equal(findSiblingIndex(0, -1, 1, anything, false), -1);
        assert.equal(findSiblingIndex(0, 0, -1, anything, true), -1);
    });

    it("steps to the neighbour", () => {
        assert.equal(findSiblingIndex(5, 2, 1, anything, false), 3);
        assert.equal(findSiblingIndex(5, 2, -1, anything, false), 1);
    });

    it("stops at the ends without circular navigation", () => {
        assert.equal(findSiblingIndex(5, 4, 1, anything, false), -1);
        assert.equal(findSiblingIndex(5, 0, -1, anything, false), -1);
    });

    it("wraps to the far end with circular navigation", () => {
        assert.equal(findSiblingIndex(5, 4, 1, anything, true), 0);
        assert.equal(findSiblingIndex(5, 0, -1, anything, true), 4);
    });

    it("starts at the first or last row when nothing is selected", () => {
        assert.equal(findSiblingIndex(5, -1, 1, anything, false), 0);
        assert.equal(findSiblingIndex(5, 5, -1, anything, false), 4);
    });

    it("skips rows the predicate rejects", () => {
        const unread = new Set([1, 4]);
        assert.equal(
            findSiblingIndex(6, 1, 1, (index) => unread.has(index), false),
            4
        );
        assert.equal(
            findSiblingIndex(6, 4, -1, (index) => unread.has(index), false),
            1
        );
    });

    it("wraps past rejected rows and stops at the starting row", () => {
        const unread = new Set([0, 3]);
        assert.equal(
            findSiblingIndex(6, 3, 1, (index) => unread.has(index), true),
            0
        );
        // The only match is the row we started from, so wrapping finds it again.
        assert.equal(
            findSiblingIndex(6, 3, 1, (index) => index === 3, true),
            3
        );
    });

    it("returns -1 when nothing matches at all", () => {
        assert.equal(
            findSiblingIndex(6, 2, 1, () => false, true),
            -1
        );
    });
});
