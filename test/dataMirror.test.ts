import { describe, it } from "node:test";
import assert from "node:assert/strict";
import BB from "backbone";
import { applyDataChange } from "../src/scripts/shared/dataMirror.ts";

const mirror = (records: Record<string, unknown>[] = []) => {
    const items = new BB.Collection(records);
    return { collections: { items }, items };
};

describe("applyDataChange", () => {
    it("adds new records", () => {
        const { collections, items } = mirror();
        applyDataChange(collections, { store: "items", added: [{ id: "a", title: "One" }] });

        assert.equal(items.length, 1);
        assert.equal(items.get("a").get("title"), "One");
    });

    it("merges an add for a record it already has", () => {
        const { collections, items } = mirror([{ id: "a", title: "One" }]);
        applyDataChange(collections, { store: "items", added: [{ id: "a", title: "Renamed" }] });

        assert.equal(items.length, 1);
        assert.equal(items.get("a").get("title"), "Renamed");
    });

    it("applies partial changes without dropping other attributes", () => {
        const { collections, items } = mirror([{ id: "a", title: "One", unread: true }]);
        applyDataChange(collections, {
            store: "items",
            changed: [{ id: "a", attrs: { unread: false } }],
        });

        assert.equal(items.get("a").get("unread"), false);
        assert.equal(items.get("a").get("title"), "One");
    });

    it("fires change events so views re-render", () => {
        const { collections, items } = mirror([{ id: "a", unread: true }]);
        const seen: unknown[] = [];
        items.get("a").on("change:unread", (_model: unknown, value: unknown) => seen.push(value));

        applyDataChange(collections, {
            store: "items",
            changed: [{ id: "a", attrs: { unread: false } }],
        });

        assert.deepEqual(seen, [false]);
    });

    it("removes records", () => {
        const { collections, items } = mirror([{ id: "a" }, { id: "b" }]);
        applyDataChange(collections, { store: "items", removed: ["a"] });

        assert.equal(items.length, 1);
        assert.equal(items.get("a"), undefined);
    });

    it("ignores changes and removals for unknown ids", () => {
        const { collections, items } = mirror([{ id: "a" }]);
        applyDataChange(collections, {
            store: "items",
            changed: [{ id: "ghost", attrs: { unread: false } }],
            removed: ["ghost"],
        });

        assert.equal(items.length, 1);
    });

    it("applies a batch with all three kinds at once", () => {
        const { collections, items } = mirror([{ id: "a", unread: true }, { id: "b" }]);
        applyDataChange(collections, {
            store: "items",
            added: [{ id: "c" }],
            changed: [{ id: "a", attrs: { unread: false } }],
            removed: ["b"],
        });

        assert.deepEqual(
            items.map((model) => model.id),
            ["a", "c"]
        );
        assert.equal(items.get("a").get("unread"), false);
    });

    it("reports an unknown store rather than throwing", () => {
        const { collections } = mirror();
        assert.equal(
            applyDataChange(collections, { store: "sources", added: [{ id: "a" }] }),
            false
        );
    });
});
