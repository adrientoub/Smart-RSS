import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSettingsStore, type StorageArea } from "../src/scripts/shared/settings.ts";
import {
    valueToBoolean,
    getElementBoolean,
    getElementSetting,
} from "../src/scripts/shared/elementSettings.ts";

function memoryArea(): StorageArea {
    const data: Record<string, unknown> = {};
    return {
        async get() {
            return { ...data };
        },
        async set(items) {
            Object.assign(data, items);
        },
        async remove(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
                delete data[key];
            }
        },
    };
}

async function storeWith(values: Record<string, unknown>) {
    const store = createSettingsStore(memoryArea());
    await store.load();
    await store.setMany(values as never);
    return store;
}

const element = (attrs: Record<string, unknown>) => ({
    get: (key: string) => attrs[key],
});

describe("valueToBoolean", () => {
    it("recognises the truthy spellings", () => {
        for (const value of [1, "1", "on", "yes", "true", true]) {
            assert.equal(valueToBoolean(value), true, `for ${JSON.stringify(value)}`);
        }
    });

    it("recognises the falsy spellings", () => {
        for (const value of [0, "0", "off", "no", "false", false]) {
            assert.equal(valueToBoolean(value), false, `for ${JSON.stringify(value)}`);
        }
    });

    it("returns anything else unchanged", () => {
        assert.equal(valueToBoolean("maybe"), "maybe");
        assert.equal(valueToBoolean(undefined), undefined);
    });
});

describe("getElementBoolean", () => {
    it('falls back to the global setting for "global"', async () => {
        const settings = await storeWith({ readOnVisit: true });
        assert.equal(
            getElementBoolean(element({ readOnVisit: "global" }), "readOnVisit", settings),
            true
        );
    });

    it("coerces a per-element override", async () => {
        const settings = await storeWith({ readOnVisit: true });
        assert.equal(
            getElementBoolean(element({ readOnVisit: "off" }), "readOnVisit", settings),
            false
        );
    });

    /**
     * Known limitation: getElementSetting treats "USE_GLOBAL" as global, this one
     * does not. Both spellings exist in old profiles.
     */
    it('does not treat "USE_GLOBAL" as global', async () => {
        const settings = await storeWith({ readOnVisit: true });
        assert.equal(
            getElementBoolean(element({ readOnVisit: "USE_GLOBAL" }), "readOnVisit", settings),
            "USE_GLOBAL"
        );
    });

    it("falls back to the global setting when there is no element", async () => {
        const settings = await storeWith({ readOnVisit: true });
        assert.equal(getElementBoolean(undefined, "readOnVisit", settings), true);
        assert.equal(getElementBoolean(null, "readOnVisit", settings), true);
    });
});

describe("getElementSetting", () => {
    it("falls back to the global setting for both global spellings", async () => {
        const settings = await storeWith({ defaultView: "content" });
        assert.equal(
            getElementSetting(element({ defaultView: "global" }), "defaultView", settings),
            "content"
        );
        assert.equal(
            getElementSetting(element({ defaultView: "USE_GLOBAL" }), "defaultView", settings),
            "content"
        );
    });

    it("returns a per-element override unchanged", async () => {
        const settings = await storeWith({ defaultView: "content" });
        assert.equal(
            getElementSetting(element({ defaultView: "website" }), "defaultView", settings),
            "website"
        );
    });

    it("falls back to the global setting when there is no element", async () => {
        const settings = await storeWith({ defaultView: "content" });
        assert.equal(getElementSetting(undefined, "defaultView", settings), "content");
        assert.equal(getElementSetting(null, "defaultView", settings), "content");
    });
});
