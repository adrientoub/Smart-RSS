import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { collections, registerCollections } from "../src/scripts/shared/collectionRegistry.ts";
import { dataHandlers } from "../src/scripts/bgprocess/modules/dataApi.js";
import { encodePassword, decodePassword } from "../src/scripts/shared/models/Source.js";

/** Enough of a Backbone collection for the write handlers. */
function fakeCollection(records: Record<string, unknown>[] = []) {
    const models = records.map((attrs) => makeModel(attrs));
    return {
        models,
        created: [] as Record<string, unknown>[],
        get(id: string) {
            return models.find((model) => model.get("id") === id);
        },
        create(attrs: Record<string, unknown>) {
            this.created.push(attrs);
            const model = makeModel({ ...attrs, id: `generated-${this.created.length}` });
            models.push(model);
            return model;
        },
    };
}

function makeModel(attrs: Record<string, unknown>) {
    const state = { ...attrs };
    return {
        state,
        destroyed: false,
        trashed: false,
        markedDeleted: false,
        get: (key: string) => state[key],
        save(update: Record<string, unknown>) {
            Object.assign(state, update);
        },
        destroy() {
            this.destroyed = true;
        },
        trash() {
            this.trashed = true;
        },
        markAsDeleted() {
            this.markedDeleted = true;
        },
    };
}

describe("background data handlers", () => {
    beforeEach(() => {
        registerCollections({
            sources: fakeCollection([{ id: "s1", hasNew: true }]),
            items: fakeCollection([
                { id: "i1", unread: true },
                { id: "i2", unread: true },
            ]),
            folders: fakeCollection([{ id: "f1", opened: false }]),
        });
    });

    it("creates a record and returns the generated id", () => {
        const result = dataHandlers["data-create"]({
            store: "folders",
            attrs: { title: "News" },
        });

        assert.equal(result.id, "generated-1");
        assert.deepEqual(collections.folders.created, [{ title: "News" }]);
    });

    it("updates every listed id in one message", () => {
        dataHandlers["data-update"]({
            store: "items",
            ids: ["i1", "i2"],
            attrs: { unread: false, visited: true },
        });

        assert.equal(collections.items.get("i1").get("unread"), false);
        assert.equal(collections.items.get("i2").get("visited"), true);
    });

    it("ignores ids that are not in the collection", () => {
        dataHandlers["data-update"]({ store: "items", ids: ["gone"], attrs: { unread: false } });
        assert.equal(collections.items.get("i1").get("unread"), true);
    });

    it("destroys, trashes and marks deleted", () => {
        const items = collections.items;
        const i1 = items.get("i1");
        const i2 = items.get("i2");

        dataHandlers["items-trash"]({ ids: ["i1"] });
        dataHandlers["items-mark-deleted"]({ ids: ["i2"] });
        dataHandlers["data-destroy"]({ store: "folders", ids: ["f1"] });

        assert.equal(i1.trashed, true);
        assert.equal(i2.markedDeleted, true);
        assert.equal(collections.folders.get("f1").destroyed, true);
    });

    it("rejects an unknown store rather than writing nowhere", () => {
        assert.throws(
            () => dataHandlers["data-update"]({ store: "nope", ids: ["x"], attrs: {} }),
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
