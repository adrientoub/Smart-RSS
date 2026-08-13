import "fake-indexeddb/auto";
import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/scripts/shared/db.ts";
import { folders, items, sources } from "../src/scripts/shared/stores.ts";
import { dataHandlers } from "../src/scripts/bgprocess/modules/dataApi.ts";
import { encodePassword, decodePassword } from "../src/scripts/shared/records.ts";

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    items.reset([
        { id: "i1", unread: true, sourceID: "s1" },
        { id: "i2", unread: true, sourceID: "s1" },
    ]);
    sources.reset([{ id: "s1", hasNew: true }]);
    folders.reset([{ id: "f1", opened: false }]);
});

after(() => db.close());

describe("background data handlers", () => {
    it("creates a record and returns its id", () => {
        const result = dataHandlers["data-create"]({
            store: "folders",
            attrs: { title: "News" },
        });

        assert.ok(result.id);
        assert.equal(folders.get(result.id).title, "News");
    });

    it("updates every listed id in one message", () => {
        dataHandlers["data-update"]({
            store: "items",
            ids: ["i1", "i2"],
            attrs: { unread: false, visited: true },
        });

        assert.equal(items.get("i1").unread, false);
        assert.equal(items.get("i2").visited, true);
    });

    it("ignores ids that are not in the store", () => {
        dataHandlers["data-update"]({ store: "items", ids: ["gone"], attrs: { unread: false } });
        assert.equal(items.get("i1").unread, true);
    });

    it("destroys records", async () => {
        dataHandlers["data-destroy"]({ store: "folders", ids: ["f1"] });
        await settled();

        assert.equal(folders.get("f1"), undefined);
    });

    it("trashes without dropping the article", () => {
        dataHandlers["items-trash"]({ ids: ["i1"] });

        assert.equal(items.get("i1").trashed, true);
        assert.equal(items.get("i1").deleted, false);
        assert.ok(items.get("i1").trashedOn > 0);
    });

    it("marks deleted, keeping a tombstone with no payload", () => {
        dataHandlers["items-mark-deleted"]({ ids: ["i2"] });

        const item = items.get("i2");
        assert.equal(item.deleted, true);
        assert.equal(item.title, "");
        assert.equal(item.content, "");
        assert.equal(item.pinned, false);
    });

    it("rejects an unknown store rather than writing nowhere", () => {
        assert.throws(
            () =>
                dataHandlers["data-update"]({
                    store: "nope" as never,
                    ids: ["x"],
                    attrs: {},
                }),
            /Unknown store: nope/
        );
    });
});

describe("source password encoding", () => {
    it("round-trips", () => {
        assert.equal(decodePassword(encodePassword("hunter2")), "hunter2");
    });

    it("encodes to the legacy enc: format", () => {
        assert.equal(encodePassword("ab"), "enc:no");
    });

    it("maps an empty password to an empty string", () => {
        assert.equal(encodePassword(""), "");
    });

    it("leaves a value that was never encoded alone", () => {
        assert.equal(decodePassword("plaintext"), "plaintext");
    });
});
