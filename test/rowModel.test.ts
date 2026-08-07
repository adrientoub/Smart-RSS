import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    buildRows,
    groupTitleByRow,
    itemRowIndexes,
    type ListRow,
} from "../src/scripts/app/helpers/rowModel.ts";

interface Article {
    id: string;
    date: number;
}

const article = (id: string, date: number): Article => ({ id, date });
const getDate = (model: Article) => model.date;
const dayOf = (date: number) => "day " + Math.floor(date / 100);

const shape = (rows: Array<ListRow<Article>>) =>
    rows.map((row) => (row.type === "group" ? "[" + row.title + "]" : row.model.id));

describe("buildRows", () => {
    it("returns nothing for an empty list", () => {
        assert.deepEqual(buildRows([], getDate, dayOf), []);
    });

    it("emits items only when grouping is disabled", () => {
        const rows = buildRows([article("a", 100), article("b", 250)], getDate, null);
        assert.deepEqual(shape(rows), ["a", "b"]);
    });

    it("opens a group before the first item of each day", () => {
        const rows = buildRows(
            [article("a", 100), article("b", 150), article("c", 250)],
            getDate,
            dayOf
        );
        assert.deepEqual(shape(rows), ["[day 1]", "a", "b", "[day 2]", "c"]);
    });

    it("numbers items by their position in the item array, not the row array", () => {
        const rows = buildRows([article("a", 100), article("b", 250)], getDate, dayOf);
        const indexes = rows.filter((row) => row.type === "item").map((row) => row.itemIndex);
        assert.deepEqual(indexes, [0, 1]);
    });

    /**
     * The list is always sorted before it is grouped, so a title cannot recur
     * once it has been closed. Encoded because the row keys assume it.
     */
    it("only opens a group once for a run of the same day", () => {
        const rows = buildRows(
            [article("a", 100), article("b", 100), article("c", 100)],
            getDate,
            dayOf
        );
        assert.equal(rows.filter((row) => row.type === "group").length, 1);
    });
});

describe("itemRowIndexes", () => {
    it("maps each item index to the row it occupies", () => {
        const rows = buildRows(
            [article("a", 100), article("b", 150), article("c", 250)],
            getDate,
            dayOf
        );
        assert.deepEqual(itemRowIndexes(rows), [1, 2, 4]);
    });

    it("is the identity without groups", () => {
        const rows = buildRows([article("a", 100), article("b", 250)], getDate, null);
        assert.deepEqual(itemRowIndexes(rows), [0, 1]);
    });
});

describe("groupTitleByRow", () => {
    it("carries the open group down over its items", () => {
        const rows = buildRows(
            [article("a", 100), article("b", 150), article("c", 250)],
            getDate,
            dayOf
        );
        assert.deepEqual(groupTitleByRow(rows), ["day 1", "day 1", "day 1", "day 2", "day 2"]);
    });

    it("is all null when there are no groups", () => {
        const rows = buildRows([article("a", 100)], getDate, null);
        assert.deepEqual(groupTitleByRow(rows), [null]);
    });
});
