import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChangeBuffer } from "../src/scripts/shared/changeBuffer.ts";

describe("createChangeBuffer", () => {
    it("holds changes until started", () => {
        const applied: string[] = [];
        const buffer = createChangeBuffer<string>((change) => applied.push(change));

        buffer.push("a");
        buffer.push("b");

        assert.deepEqual(applied, []);
        assert.equal(buffer.buffering, true);
    });

    it("replays what it held, in order", () => {
        const applied: string[] = [];
        const buffer = createChangeBuffer<string>((change) => applied.push(change));

        buffer.push("a");
        buffer.push("b");
        buffer.start();

        assert.deepEqual(applied, ["a", "b"]);
        assert.equal(buffer.buffering, false);
    });

    it("applies immediately once started", () => {
        const applied: string[] = [];
        const buffer = createChangeBuffer<string>((change) => applied.push(change));
        buffer.start();

        buffer.push("a");

        assert.deepEqual(applied, ["a"]);
    });

    it("starting twice does not replay anything again", () => {
        const applied: string[] = [];
        const buffer = createChangeBuffer<string>((change) => applied.push(change));

        buffer.push("a");
        buffer.start();
        buffer.start();

        assert.deepEqual(applied, ["a"]);
    });

    it("starting with nothing held is harmless", () => {
        const applied: string[] = [];
        const buffer = createChangeBuffer<string>((change) => applied.push(change));

        buffer.start();

        assert.deepEqual(applied, []);
    });
});
