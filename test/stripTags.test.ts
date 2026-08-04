import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadAmd } from "./helpers/loadAmd.ts";

const stripTags = loadAmd<(s: unknown) => string>("scripts/app/helpers/stripTags.js");

describe("stripTags", () => {
    it("returns an empty string for falsy input", () => {
        assert.equal(stripTags(""), "");
        assert.equal(stripTags(null), "");
        assert.equal(stripTags(undefined), "");
        assert.equal(stripTags(0), "");
    });

    it("removes opening and closing tags but keeps text", () => {
        assert.equal(stripTags("<p>hello</p>"), "hello");
        assert.equal(stripTags("<a href='#'>link</a> tail"), "link tail");
    });

    it("removes self-closing and attribute-heavy tags", () => {
        assert.equal(stripTags('<img src="x.png" alt="a"/>caption'), "caption");
    });

    // Known limitation: the regex is naive, so prose containing bare angle
    // brackets is treated as a tag and swallowed.
    it("swallows text between bare angle brackets", () => {
        assert.equal(stripTags("2 < 3 and 4 > 1"), "2  1");
    });
});
