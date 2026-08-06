import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { staticMessageKey, translateFor } from "../src/scripts/shared/i18n.ts";
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

    it("covers every static options-page string", async () => {
        const html = await readFile(new URL("../src/options.html", import.meta.url), "utf8");
        const texts = new Set<string>();
        for (const match of html.matchAll(/\b(?:title|placeholder)\s*=\s*"([^"]+)"/g)) {
            texts.add(match[1].replace(/\s+/g, " ").trim().replace(/:$/, ""));
        }
        for (const match of html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/>([^<>]+)</g)) {
            const text = match[1].replace(/\s+/g, " ").trim().replace(/:$/, "");
            if (text && text !== "%") {
                texts.add(text);
            }
        }

        const englishMessages = new Set(
            Object.values(languages.en.messages).map((entry) => entry.message)
        );
        for (const text of texts) {
            assert.ok(
                englishMessages.has(text) || languages.en.messages[staticMessageKey(text)],
                `Missing options message: ${text}`
            );
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