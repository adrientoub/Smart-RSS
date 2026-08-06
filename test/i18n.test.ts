import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { translateFor } from "../src/scripts/shared/i18n.ts";
import { availableLanguageCodes, languages } from "../src/scripts/shared/locales.ts";

describe("locale catalogs", () => {
    const englishKeys = Object.keys(languages.en.messages).sort();

    for (const code of availableLanguageCodes) {
        it(`${code} has the complete English key set`, () => {
            const messages = languages[code].messages;
            assert.deepEqual(Object.keys(messages).sort(), englishKeys);
            for (const entry of Object.values(messages)) {
                assert.ok(entry.message.trim());
            }
        });
    }

    it("defines every message referenced by the options page", async () => {
        const html = await readFile(new URL("../src/options.html", import.meta.url), "utf8");
        const keys = html.matchAll(/\bdata-i18n(?:-title)?="([A-Z0-9_]+)"/g);
        for (const [, key] of keys) {
            assert.ok(key in languages.en.messages, `Missing options message: ${key}`);
        }

        const uncommented = html.replace(/<!--[\s\S]*?-->/g, "");
        for (const match of uncommented.matchAll(/<[^>]+\stitle="[^"]+"[^>]*>/g)) {
            assert.match(match[0], /\bdata-i18n-title=/, `Unmarked tooltip: ${match[0]}`);
        }
        for (const match of uncommented.matchAll(
            /(<([a-z][\w-]*)(?:\s[^<>]*?)?>)([^<>]+)<\/\2>/g
        )) {
            const text = match[3].replace(/\s+/g, " ").trim();
            if (text && text !== "%") {
                assert.match(match[1], /\bdata-i18n=/, `Unmarked options text: ${text}`);
            }
        }
    });
});

describe("translation", () => {
    it("falls back to English without decorating the message", () => {
        assert.equal(translateFor("ja", "DELETE"), "Delete");
        assert.equal(
            translateFor("cs", "FULL_ARTICLE_SINGLE"),
            languages.cs.messages.FULL_ARTICLE_SINGLE.message
        );
    });

    it("supports named substitutions", () => {
        assert.equal(
            translateFor("en", "PINNED_DELETE_CONFIRM", { title: "Example" }),
            'Item "Example" is pinned. Do you really want to delete it?'
        );
    });

    it("returns an unknown key unchanged", () => {
        assert.equal(translateFor("en", "NOT_A_MESSAGE"), "NOT_A_MESSAGE");
    });
});