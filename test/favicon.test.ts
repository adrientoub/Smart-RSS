import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    expiresFrom,
    faviconUrlFor,
    getImageData,
} from "../src/scripts/bgprocess/modules/favicon.ts";

const buffer = (bytes: number[]) => new Uint8Array(bytes).buffer;
const filled = (size: number, value = 0x41) => new Uint8Array(size).fill(value).buffer;

describe("faviconUrlFor", () => {
    it("asks the site for /favicon.ico", () => {
        assert.equal(faviconUrlFor("https://example.com/blog/"), "https://example.com/favicon.ico");
    });

    it("drops any path, query and fragment from the base", () => {
        assert.equal(
            faviconUrlFor("https://example.com/deep/path?a=1#x"),
            "https://example.com/favicon.ico"
        );
    });

    it("keeps a non-default port", () => {
        assert.equal(
            faviconUrlFor("http://localhost:8080/feed"),
            "http://localhost:8080/favicon.ico"
        );
    });

    it("keeps the scheme of the base", () => {
        assert.equal(faviconUrlFor("http://example.com/"), "http://example.com/favicon.ico");
    });

    it("throws on a base that is not a url", () => {
        assert.throws(() => faviconUrlFor("not a url"));
    });
});

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
        const size = 0x8000 * 3 + 17;
        const result = getImageData("image/x-icon", filled(size, 0x41));
        assert.ok(result?.startsWith("data:image/x-icon;base64,"));

        const base64 = result!.slice("data:image/x-icon;base64,".length);
        const decoded = Buffer.from(base64, "base64");
        assert.equal(decoded.length, size);
        assert.ok(decoded.every((byte) => byte === 0x41));
    });

    it("round-trips arbitrary byte values", () => {
        const bytes = Array.from({ length: 256 }, (_, i) => i);
        const result = getImageData("image/gif", buffer(bytes));
        const base64 = result!.slice("data:image/gif;base64,".length);
        assert.deepEqual([...Buffer.from(base64, "base64")], bytes);
    });
});

describe("favicon expiresFrom", () => {
    const nowSeconds = () => Math.round(Date.now() / 1000);

    it("uses the expires header when present", () => {
        const headers = new Headers({ expires: "Wed, 05 Mar 2025 08:30:00 GMT" });
        assert.equal(expiresFrom(headers), Math.round(Date.parse("2025-03-05T08:30:00Z") / 1000));
    });

    it("defaults to a week when no caching headers are present", () => {
        const expires = expiresFrom(new Headers());
        assert.ok(Math.abs(expires - (nowSeconds() + 60 * 60 * 24 * 7)) <= 2);
    });

    // Known limitation: max-age is clamped upward by Math.max against the one week
    // default, so shorter cache lifetimes are ignored rather than honoured.
    it("ignores a max-age shorter than the default week", () => {
        const headers = new Headers({ "cache-control": "max-age=60" });
        const expires = expiresFrom(headers);
        assert.ok(Math.abs(expires - (nowSeconds() + 60 * 60 * 24 * 7)) <= 2);
    });

    it("honours a max-age longer than the default week", () => {
        const thirtyDays = 60 * 60 * 24 * 30;
        const headers = new Headers({ "cache-control": `max-age=${thirtyDays}` });
        const expires = expiresFrom(headers);
        assert.ok(Math.abs(expires - (nowSeconds() + thirtyDays)) <= 2);
    });
});
