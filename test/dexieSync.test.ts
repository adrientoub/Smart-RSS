import "fake-indexeddb/auto";
import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/scripts/shared/db.ts";
import { dexieSync, tableNameOf, type SyncModel } from "../src/scripts/shared/dexieSync.ts";

/** Enough of a Backbone model for the adapter. */
function fakeModel(table: string, attrs: Record<string, unknown> = {}): SyncModel {
    const state: Record<string, unknown> = { ...attrs };
    return {
        id: state.id as string | undefined,
        idAttribute: "id",
        collection: { dexieTable: table },
        toJSON: () => ({ ...state }),
        set(key: string, value: unknown) {
            state[key] = value;
        },
    };
}

beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
});

after(() => db.close());

describe("dexieSync", () => {
    it("resolves the table from the model or its collection", () => {
        assert.equal(tableNameOf(fakeModel("items")), "items");
        assert.equal(tableNameOf({ dexieTable: "sources" } as SyncModel), "sources");
        assert.equal(tableNameOf({} as SyncModel), undefined);
    });

    it("rejects a model with no table", async () => {
        await assert.rejects(() => dexieSync("read", {} as SyncModel));
    });

    it("assigns an id synchronously, before the write lands", async () => {
        const model = fakeModel("sources", { title: "Example", url: "https://example.com/" });
        const written = dexieSync("create", model);

        assert.ok(model.id, "id must be readable as soon as sync returns");

        await written;
        assert.deepEqual(await db.table("sources").get(model.id as string), {
            title: "Example",
            url: "https://example.com/",
            id: model.id,
        });
    });

    it("keeps an id the model already has", async () => {
        const model = fakeModel("items", { id: "guid-1", sourceID: "s1", date: 5 });
        await dexieSync("create", model);

        assert.equal(model.id, "guid-1");
        assert.equal((await db.table("items").get("guid-1")).sourceID, "s1");
    });

    it("reads the whole table for a collection and one record for a model", async () => {
        await db.table("items").bulkPut([
            { id: "a", sourceID: "s1", date: 1 },
            { id: "b", sourceID: "s1", date: 2 },
        ]);

        const all = (await dexieSync("read", {
            dexieTable: "items",
        } as SyncModel)) as Record<string, unknown>[];
        assert.deepEqual(
            all.map((record) => record.id),
            ["a", "b"]
        );

        const one = await dexieSync("read", fakeModel("items", { id: "b" }));
        assert.equal((one as Record<string, unknown>).date, 2);
    });

    it("replaces the stored record on update", async () => {
        const model = fakeModel("items", { id: "a", sourceID: "s1", unread: true });
        await dexieSync("create", model);
        model.set("unread", false);
        await dexieSync("update", model);

        assert.equal((await db.table("items").get("a")).unread, false);
    });

    it("removes the stored record on delete", async () => {
        const model = fakeModel("items", { id: "a", sourceID: "s1" });
        await dexieSync("create", model);
        await dexieSync("delete", model);

        assert.equal(await db.table("items").get("a"), undefined);
    });

    it("keys toolbars by region rather than id", async () => {
        const model = fakeModel("toolbars", { region: "feeds", actions: [] });
        await dexieSync("create", model);

        assert.equal((await db.table("toolbars").get("feeds")).region, "feeds");

        await dexieSync("delete", model);
        assert.equal(await db.table("toolbars").get("feeds"), undefined);
    });

    it("reports through success and complete, and through error on failure", async () => {
        const calls: string[] = [];
        const model = fakeModel("items", { id: "a", sourceID: "s1" });

        await dexieSync("create", model, {
            success: () => calls.push("success"),
            complete: () => calls.push("complete"),
        });
        assert.deepEqual(calls, ["success", "complete"]);

        // Same id again: `create` uses add, which must not overwrite.
        await assert.rejects(() =>
            dexieSync("create", fakeModel("items", { id: "a" }), {
                error: () => calls.push("error"),
            })
        );
        assert.ok(calls.includes("error"));
    });
});
