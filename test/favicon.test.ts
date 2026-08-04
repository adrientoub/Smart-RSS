import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getImageData } from "../src/scripts/bgprocess/modules/favicon.js";

const buffer = (bytes: number[]) => new Uint8Array(bytes).buffer;
const filled = (size: number, value = 0x41) => new Uint8Array(size).fill(value).buffer;

describe("favicon getImageData", () => {
    it("returns a data URI for an image response", () => {
        const result = getImageData("image/png", buffer([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
        assert.ok(result?.startsWith("data:image/png;base64,"));
    });

    it("rejects non-image content types", () => {
        assert.equal(getImageData("text/html", filled(100)), undefined);
    });

    it("rejects a missing content type instead of throwing", () => {
        assert.equal(getImageData(null, filled(100)), undefined);
    });

    it("rejects responses too small to be an image", () => {
        assert.equal(getImageData("image/png", buffer([1, 2, 3])), undefined);
    });

    it("encodes payloads larger than one chunk without overflowing the stack", () => {
        // 0x8000 is the chunk size, so this spans several chunks.
        const size = 0x8000 * 3 + 17;
        const result = getImageData("image/x-icon", filled(size, 0x41));
        assert.ok(result?.startsWith("data:image/x-icon;base64,"));

        const base64 = result.slice("data:image/x-icon;base64,".length);
        const decoded = Buffer.from(base64, "base64");
        assert.equal(decoded.length, size);
        assert.ok(decoded.every((byte) => byte === 0x41));
    });

    it("round-trips arbitrary byte values", () => {
        const bytes = Array.from({ length: 256 }, (_, i) => i);
        const result = getImageData("image/gif", buffer(bytes));
        const base64 = result.slice("data:image/gif;base64,".length);
        assert.deepEqual([...Buffer.from(base64, "base64")], bytes);
    });
});
