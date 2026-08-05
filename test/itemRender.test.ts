import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isReadStateOnlyChange } from "../src/scripts/app/helpers/itemRender.js";

describe("isReadStateOnlyChange", () => {
    it("is true for unread or visited alone", () => {
        assert.equal(isReadStateOnlyChange({ unread: false }), true);
        assert.equal(isReadStateOnlyChange({ visited: true }), true);
    });

    it("is true for the two together", () => {
        assert.equal(isReadStateOnlyChange({ unread: false, visited: true }), true);
    });

    it("is false when anything else changed", () => {
        assert.equal(isReadStateOnlyChange({ title: "x" }), false);
        assert.equal(isReadStateOnlyChange({ unread: false, title: "x" }), false);
        assert.equal(isReadStateOnlyChange({ unread: false, visited: true, pinned: true }), false);
    });

    /** Backbone returns false from changedAttributes() when nothing changed. */
    it("is false for no change", () => {
        assert.equal(isReadStateOnlyChange(false), false);
        assert.equal(isReadStateOnlyChange(undefined), false);
        assert.equal(isReadStateOnlyChange({}), false);
    });
});
