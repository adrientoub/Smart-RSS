import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    applyTheme,
    isThemePreference,
    resolveTheme,
    toggledTheme,
} from "../src/scripts/shared/theme.ts";

describe("resolveTheme", () => {
    it("follows the browser when set to auto", () => {
        assert.equal(resolveTheme("auto", true), "dark");
        assert.equal(resolveTheme("auto", false), "light");
    });

    it("ignores the browser when pinned", () => {
        assert.equal(resolveTheme("light", true), "light");
        assert.equal(resolveTheme("dark", false), "dark");
    });

    it("maps the named palettes onto a base scheme", () => {
        assert.equal(resolveTheme("oled", false), "dark");
        assert.equal(resolveTheme("nord", false), "dark");
        assert.equal(resolveTheme("sepia", true), "light");
    });
});

describe("toggledTheme", () => {
    it("always produces an explicit choice", () => {
        assert.equal(toggledTheme("auto", false), "dark");
        assert.equal(toggledTheme("auto", true), "light");
    });

    it("flips a pinned theme", () => {
        assert.equal(toggledTheme("dark", false), "light");
        assert.equal(toggledTheme("light", true), "dark");
    });

    it("leaves a named palette for plain light or dark", () => {
        assert.equal(toggledTheme("oled", false), "light");
        assert.equal(toggledTheme("sepia", true), "dark");
    });
});

describe("isThemePreference", () => {
    it("accepts only the known preferences", () => {
        assert.equal(isThemePreference("auto"), true);
        assert.equal(isThemePreference("dark"), true);
        assert.equal(isThemePreference("oled"), true);
        assert.equal(isThemePreference("sepia"), true);
        assert.equal(isThemePreference("nord"), true);
        assert.equal(isThemePreference("inverted"), false);
        assert.equal(isThemePreference(undefined), false);
    });
});

describe("applyTheme", () => {
    it("writes the preference onto the document element", () => {
        const attributes: Record<string, string> = {};
        const document = {
            documentElement: {
                setAttribute: (name: string, value: string) => {
                    attributes[name] = value;
                },
            },
        } as unknown as Document;

        applyTheme(document, "dark");
        assert.equal(attributes["data-theme"], "dark");
    });

    it("tolerates a sandbox document that is not there yet", () => {
        assert.doesNotThrow(() => applyTheme(null, "light"));
        assert.doesNotThrow(() => applyTheme(undefined, "light"));
    });
});
