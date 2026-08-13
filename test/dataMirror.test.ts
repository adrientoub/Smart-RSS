import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RecordStore } from "../src/scripts/shared/recordStore.ts";
import { applyDataChange } from "../src/scripts/shared/dataMirror.ts";

interface Row {
    id: string;
    title: string;
    unread: boolean;
}

const mirror = (records: (Partial<Row> & { id: string })[] = []) => {
    const items = new RecordStore<Row>({ title: "", unread: true });
    items.add(records);
    return { stores: { items } as never, items };
};

describe("applyDataChange", () => {
    it("adds new records", () => {
        const { stores, items } = mirror();
        applyDataChange(stores, { store: "items", added: [{ id: "a", title: "One" }] });

        assert.equal(items.size, 1);
        assert.equal(items.get("a").title, "One");
    });

    it("merges an add for a record it already has", () => {
        const { stores, items } = mirror([{ id: "a", title: "One" }]);
        applyDataChange(stores, { store: "items", added: [{ id: "a", title: "Renamed" }] });

        assert.equal(items.size, 1);
        assert.equal(items.get("a").title, "Renamed");
    });

    it("applies partial changes without dropping other attributes", () => {
        const { stores, items } = mirror([{ id: "a", title: "One", unread: true }]);
        applyDataChange(stores, {
            store: "items",
            changed: [{ id: "a", attrs: { unread: false } }],
        });

        assert.equal(items.get("a").unread, false);
        assert.equal(items.get("a").title, "One");
    });

    it("notifies subscribers so the UI re-renders", () => {
        const { stores, items } = mirror([{ id: "a", unread: true }]);
        const seen: unknown[] = [];
        items.subscribe((change) => seen.push(change.changed[0]?.attrs));

        applyDataChange(stores, {
            store: "items",
            changed: [{ id: "a", attrs: { unread: false } }],
        });

        assert.deepEqual(seen, [{ unread: false }]);
    });

    it("removes records", () => {
        const { stores, items } = mirror([{ id: "a" }, { id: "b" }]);
        applyDataChange(stores, { store: "items", removed: ["a"] });

        assert.equal(items.size, 1);
        assert.equal(items.get("a"), undefined);
    });

    it("ignores changes and removals for unknown ids", () => {
        const { stores, items } = mirror([{ id: "a" }]);
        applyDataChange(stores, {
            store: "items",
            changed: [{ id: "ghost", attrs: { unread: false } }],
            removed: ["ghost"],
        });

        assert.equal(items.size, 1);
    });

    it("applies a batch with all three kinds at once", () => {
        const { stores, items } = mirror([{ id: "a", unread: true }, { id: "b" }]);
        applyDataChange(stores, {
            store: "items",
            added: [{ id: "c" }],
            changed: [{ id: "a", attrs: { unread: false } }],
            removed: ["b"],
        });

        assert.deepEqual(
            items.all().map((record) => record.id),
            ["a", "c"]
        );
        assert.equal(items.get("a").unread, false);
    });

    it("reports an unknown store rather than throwing", () => {
        const { stores } = mirror();
        assert.equal(applyDataChange(stores, { store: "sources", added: [{ id: "a" }] }), false);
    });
});
