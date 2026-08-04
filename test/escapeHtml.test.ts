import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadAmd } from "./helpers/loadAmd.ts";

const escapeHtml = loadAmd<(s: unknown) => string>("scripts/app/helpers/escapeHtml.js");

describe("escapeHtml", () => {
    it("escapes the five HTML-significant characters", () => {
        assert.equal(escapeHtml("&"), "&amp;");
        assert.equal(escapeHtml("<"), "&lt;");
        assert.equal(escapeHtml(">"), "&gt;");
        assert.equal(escapeHtml('"'), "&quot;");
        assert.equal(escapeHtml("'"), "&#39;");
    });

    it("neutralises a script tag", () => {
        assert.equal(
            escapeHtml("<script>alert('xss')</script>"),
            "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
        );
    });

    // `entityMap` contains a "/" -> "&#x2F;" entry, but the replace regex is
    // /[&<>"']/ so slashes are never actually escaped. Harmless, but dead config.
    it("does not escape forward slashes despite the entity map entry", () => {
        assert.equal(escapeHtml("a/b"), "a/b");
    });

    it("escapes ampersands before other entities so output is not double-decoded", () => {
        assert.equal(escapeHtml("&lt;"), "&amp;lt;");
    });

    it("coerces non-string input", () => {
        assert.equal(escapeHtml(42), "42");
        assert.equal(escapeHtml(null), "null");
    });

    it("leaves plain text untouched", () => {
        assert.equal(escapeHtml("hello world"), "hello world");
    });
});
