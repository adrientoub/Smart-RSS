import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunk, MAX_RECORDS_PER_MESSAGE } from "../src/scripts/bgprocess/modules/dataBroadcast.js";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

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
