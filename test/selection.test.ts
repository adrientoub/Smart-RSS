import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    emptySelection,
    pruneSelection,
    selectAll,
    selectId,
} from "../src/scripts/app/helpers/selection.ts";

const order = ["a", "b", "c", "d"];

describe("selectId", () => {
    it("replaces the selection and reports a pick for a plain click", () => {
        const result = selectId(emptySelection, order, "b");

        assert.deepEqual(result.state.selected, ["b"]);
        assert.equal(result.state.pivot, "b");
        assert.equal(result.picked, true);
    });

    it("extends from the pivot for a shift click, without picking", () => {
        const first = selectId(emptySelection, order, "b").state;
        const result = selectId(first, order, "d", { shiftKey: true });

        assert.deepEqual(result.state.selected.sort(), ["b", "c", "d"]);
        assert.equal(result.picked, false);
    });

    it("extends backwards too", () => {
        const first = selectId(emptySelection, order, "c").state;
        const result = selectId(first, order, "a", { shiftKey: true });

        assert.deepEqual(result.state.selected.sort(), ["a", "b", "c"]);
    });

    it("adds to the selection with ctrl", () => {
        const first = selectId(emptySelection, order, "a").state;
        const result = selectId(first, order, "c", { ctrlKey: true });

        assert.deepEqual(result.state.selected, ["a", "c"]);
        assert.equal(result.picked, false);
    });

    it("removes an already selected row with ctrl", () => {
        const first = selectId(emptySelection, order, "a").state;
        const second = selectId(first, order, "c", { ctrlKey: true }).state;
        const result = selectId(second, order, "a", { ctrlKey: true });

        assert.deepEqual(result.state.selected, ["c"]);
        assert.equal(result.state.pivot, null);
    });

    it("treats a shift click with no pivot as a plain one", () => {
        const result = selectId(emptySelection, order, "c", { shiftKey: true });

        assert.deepEqual(result.state.selected, ["c"]);
        assert.equal(result.picked, true);
    });

    it("ignores an id that is not in the list", () => {
        const result = selectId(emptySelection, order, "ghost");

        assert.equal(result.state, emptySelection);
        assert.equal(result.picked, false);
    });

    it("picks a shift range when the caller forces it", () => {
        const first = selectId(emptySelection, order, "a").state;
        const result = selectId(first, order, "b", { shiftKey: true }, true);

        assert.equal(result.picked, true);
    });
});

describe("pruneSelection", () => {
    it("drops ids the list no longer has", () => {
        const state = { selected: ["a", "gone"], pivot: "gone", last: "a" };
        const pruned = pruneSelection(state, order);

        assert.deepEqual(pruned.selected, ["a"]);
        assert.equal(pruned.pivot, null);
        assert.equal(pruned.last, "a");
    });

    it("returns the same object when nothing is missing", () => {
        const state = { selected: ["a"], pivot: "a", last: "a" };
        assert.equal(pruneSelection(state, order), state);
    });
});

describe("selectAll", () => {
    it("selects every row and anchors on the ends", () => {
        const state = selectAll(order);

        assert.deepEqual(state.selected, order);
        assert.equal(state.pivot, "a");
        assert.equal(state.last, "d");
    });

    it("survives an empty list", () => {
        assert.deepEqual(selectAll([]), { selected: [], pivot: null, last: null });
    });
});
