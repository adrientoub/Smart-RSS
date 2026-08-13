import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RecordStore, type StoreChange } from "../src/scripts/shared/recordStore.ts";

interface Row {
    id: string;
    title: string;
    unread: boolean;
}

const defaults = { title: "<no title>", unread: true };

const store = (records: (Partial<Row> & { id: string })[] = []) => {
    const created = new RecordStore<Row>(defaults);
    created.add(records);
    return created;
};

describe("RecordStore", () => {
    it("fills defaults on insert only", () => {
        const records = store([{ id: "a" }]);
        assert.equal(records.get("a").title, "<no title>");

        records.add([{ id: "a", unread: false }]);
        assert.equal(records.get("a").title, "<no title>");
        assert.equal(records.get("a").unread, false);
    });

    it("replaces the record object so it can be compared by reference", () => {
        const records = store([{ id: "a" }]);
        const before = records.get("a");
        records.update("a", { unread: false });

        assert.notEqual(records.get("a"), before);
        assert.equal(before.unread, true);
    });

    it("reports only the attributes that actually changed", () => {
        const records = store([{ id: "a", title: "One", unread: true }]);
        const seen: StoreChange<Row>[] = [];
        records.subscribe((change) => seen.push(change));

        records.update("a", { title: "One", unread: false });

        assert.equal(seen.length, 1);
        assert.deepEqual(seen[0].changed[0].attrs, { unread: false });
    });

    it("says nothing when an update changes nothing", () => {
        const records = store([{ id: "a", title: "One" }]);
        let notifications = 0;
        records.subscribe(() => (notifications += 1));

        records.update("a", { title: "One" });

        assert.equal(notifications, 0);
    });

    it("notifies once for a whole batch", () => {
        const records = store();
        let notifications = 0;
        records.subscribe(() => (notifications += 1));

        records.add([{ id: "a" }, { id: "b" }, { id: "c" }]);

        assert.equal(notifications, 1);
        assert.equal(records.size, 3);
    });

    it("ignores a patch for an unknown id rather than creating a partial record", () => {
        const records = store([{ id: "a" }]);
        records.patch([{ id: "ghost", attrs: { unread: false } }]);

        assert.equal(records.size, 1);
        assert.equal(records.get("ghost"), undefined);
    });

    it("removes records and reports what went", () => {
        const records = store([{ id: "a" }, { id: "b" }]);
        const removed = records.remove(["a", "missing"]);

        assert.deepEqual(
            removed.map((record) => record.id),
            ["a"]
        );
        assert.equal(records.size, 1);
    });

    it("marks a reset so consumers can skip re-broadcasting it", () => {
        const records = store([{ id: "a" }]);
        const seen: StoreChange<Row>[] = [];
        records.subscribe((change) => seen.push(change));

        records.reset([{ id: "b" }]);

        assert.equal(seen[0].reset, true);
        assert.deepEqual(
            seen[0].removed.map((record) => record.id),
            ["a"]
        );
        assert.equal(records.size, 1);
    });

    it("queries by attributes", () => {
        const records = store([
            { id: "a", unread: true },
            { id: "b", unread: false },
        ]);

        assert.deepEqual(
            records.where({ unread: true }).map((record) => record.id),
            ["a"]
        );
        assert.equal(records.findWhere({ unread: false }).id, "b");
    });

    it("bumps its version on every change, for useSyncExternalStore", () => {
        const records = store();
        const before = records.version;
        records.add([{ id: "a" }]);

        assert.ok(records.version > before);
    });
});
