import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    chunk,
    MAX_RECORDS_PER_MESSAGE,
    startDataBroadcast,
} from "../src/scripts/bgprocess/modules/dataBroadcast.js";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Minimal stand-ins for the Backbone collections the broadcaster watches. */
function fakeCollections() {
    const handlers: Record<string, Record<string, (model: unknown) => void>> = {};
    const make = (store: string) => {
        handlers[store] = {};
        return {
            on(event: string, callback: (model: unknown) => void) {
                handlers[store][event] = callback;
            },
        };
    };
    const collections = {
        sources: make("sources"),
        folders: make("folders"),
        toolbars: make("toolbars"),
        items: make("items"),
    };
    const add = (store: string, id: string) =>
        handlers[store].add({ toJSON: () => ({ id }), get: () => id });
    return { collections, add };
}

function captureMessages() {
    const sent: { action: string; payload: { store: string } }[] = [];
    (globalThis as { browser?: unknown }).browser = {
        runtime: {
            sendMessage: (message: { action: string; payload: { store: string } }) => {
                sent.push(message);
                return Promise.resolve();
            },
        },
    };
    return sent;
}

describe("broadcast ordering", () => {
    /**
     * An article rendered in a multi-feed view looks its source up by id. If the
     * articles arrive first the lookup misses and the row renders blank.
     */
    it("sends sources before items, whatever order they changed in", async () => {
        const sent = captureMessages();
        const { collections, add } = fakeCollections();
        startDataBroadcast(collections);

        add("items", "i1");
        add("sources", "s1");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.deepEqual(
            sent.map((message) => message.payload.store),
            ["sources", "items"]
        );
    });

    it("coalesces one task into a single flush", async () => {
        const sent = captureMessages();
        const { collections, add } = fakeCollections();
        startDataBroadcast(collections);

        add("items", "i1");
        add("items", "i2");
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(sent.length, 1);
    });
});

describe("broadcast chunking", () => {
    it("keeps a small batch as one message", () => {
        assert.deepEqual(chunk([1, 2, 3]), [[1, 2, 3]]);
    });

    it("produces nothing for an empty batch", () => {
        assert.deepEqual(chunk([]), []);
    });

    /**
     * The bug this guards: a mass refresh coalesced every feed's articles into a
     * single message, which was large enough to fail to send.
     */
    it("splits a large batch and keeps every record exactly once", () => {
        const records = range(105);
        const chunks = chunk(records);

        assert.equal(chunks.length, Math.ceil(105 / MAX_RECORDS_PER_MESSAGE));
        chunks.forEach((part) => assert.ok(part.length <= MAX_RECORDS_PER_MESSAGE));
        assert.deepEqual(chunks.flat(), records);
    });

    it("splits exactly on the boundary without an empty tail", () => {
        const chunks = chunk(range(MAX_RECORDS_PER_MESSAGE * 2));

        assert.equal(chunks.length, 2);
        assert.deepEqual(chunks.flat().length, MAX_RECORDS_PER_MESSAGE * 2);
    });
});
