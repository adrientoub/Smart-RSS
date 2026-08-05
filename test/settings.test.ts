import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createSettingsStore, type StorageArea } from "../src/scripts/shared/settings.ts";
import {
    migrateSettings,
    pickKnownSettings,
    MIGRATION_FLAG,
} from "../src/scripts/shared/settingsMigration.ts";
import { createDefaults, defaultLanguage } from "../src/scripts/shared/settingsSchema.ts";

function fakeStorage(initial: Record<string, unknown> = {}) {
    const data: Record<string, unknown> = { ...initial };
    const area: StorageArea & { data: Record<string, unknown> } = {
        data,
        async get(keys) {
            if (keys === undefined || keys === null) {
                return { ...data };
            }
            const list = Array.isArray(keys) ? keys : [keys];
            const picked: Record<string, unknown> = {};
            for (const key of list) {
                if (key in data) {
                    picked[key] = data[key];
                }
            }
            return picked;
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
    return area;
}

describe("defaultLanguage", () => {
    it("uses the base language when it ships with the extension", () => {
        assert.equal(defaultLanguage("fr-FR"), "fr");
        assert.equal(defaultLanguage("de"), "de");
    });

    it("falls back to English for anything else", () => {
        assert.equal(defaultLanguage("ja-JP"), "en");
        assert.equal(defaultLanguage(""), "en");
    });
});

describe("settings store", () => {
    let area: ReturnType<typeof fakeStorage>;
    let store: ReturnType<typeof createSettingsStore>;

    beforeEach(async () => {
        area = fakeStorage();
        store = createSettingsStore(area);
        await store.load();
    });

    it("reads defaults before anything is stored", () => {
        assert.equal(store.get("updateFrequency"), 15);
        assert.equal(store.get("layout"), "horizontal");
        assert.equal(store.get("invertColors"), false);
    });

    it("reads back what it wrote, synchronously", async () => {
        await store.set("updateFrequency", 30);
        assert.equal(store.get("updateFrequency"), 30);
    });

    it("persists under a namespaced key", async () => {
        await store.set("layout", "vertical");
        assert.equal(area.data["setting.layout"], "vertical");
    });

    it("restores stored values on load", async () => {
        await store.set("layout", "vertical");
        const second = createSettingsStore(area);
        await second.load();
        assert.equal(second.get("layout"), "vertical");
    });

    it("ignores unrelated storage keys when loading", async () => {
        area.data["someOtherFeature"] = "x";
        await store.load();
        assert.equal(store.get("layout"), "horizontal");
    });

    it("rejects an unknown setting rather than storing it", async () => {
        await assert.rejects(
            () => store.set("nonsense" as never, 1 as never),
            /Unknown setting: nonsense/
        );
    });

    it("notifies per-key and general listeners", async () => {
        const seen: string[] = [];
        store.on("change:layout", (key, value) => seen.push(`key:${key}=${value}`));
        store.on("change", (key) => seen.push(`any:${key}`));

        await store.set("layout", "vertical");
        assert.deepEqual(seen, ["key:layout=vertical", "any:layout"]);
    });

    it("does not notify listeners for other keys", async () => {
        let called = false;
        store.on("change:layout", () => {
            called = true;
        });
        await store.set("updateFrequency", 30);
        assert.equal(called, false);
    });

    it("stops notifying after off()", async () => {
        let count = 0;
        const listener = () => {
            count++;
        };
        store.on("change:layout", listener);
        await store.set("layout", "vertical");
        store.off("change:layout", listener);
        await store.set("layout", "horizontal");
        assert.equal(count, 1);
    });

    it("setMany writes and announces every known key", async () => {
        const seen: string[] = [];
        store.on("change", (key) => seen.push(key));

        await store.setMany({ layout: "vertical", updateFrequency: 45 });

        assert.equal(store.get("layout"), "vertical");
        assert.equal(store.get("updateFrequency"), 45);
        assert.deepEqual(seen.sort(), ["layout", "updateFrequency"]);
    });

    it("setMany skips keys the schema does not know", async () => {
        await store.setMany({ layout: "vertical", bogus: 1 } as never);
        assert.equal(area.data["setting.bogus"], undefined);
    });

    it("clear returns every setting to its default", async () => {
        await store.set("layout", "vertical");
        await store.clear();
        assert.equal(store.get("layout"), "horizontal");
        assert.equal(area.data["setting.layout"], undefined);
    });

    it("toJSON returns a copy, not the live object", async () => {
        const snapshot = store.toJSON();
        await store.set("layout", "vertical");
        assert.equal(snapshot.layout, "horizontal");
    });
});

describe("settings store / cross-context updates", () => {
    it("adopts a change made in another context", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        const seen: unknown[] = [];
        store.on("change:layout", (_key, value) => seen.push(value));

        store.applyExternalChanges({ "setting.layout": { newValue: "vertical" } });

        assert.equal(store.get("layout"), "vertical");
        assert.deepEqual(seen, ["vertical"]);
    });

    // Our own writes come back through onChanged; announcing twice would make
    // listeners run the same work again.
    it("ignores an echo of a value it already holds", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();
        await store.set("layout", "vertical");

        let count = 0;
        store.on("change:layout", () => {
            count++;
        });
        store.applyExternalChanges({ "setting.layout": { newValue: "vertical" } });

        assert.equal(count, 0);
    });

    it("treats a removed key as a reset to the default", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();
        await store.set("layout", "vertical");

        store.applyExternalChanges({ "setting.layout": {} });

        assert.equal(store.get("layout"), "horizontal");
    });

    it("ignores changes to keys outside the schema", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        store.applyExternalChanges({ somethingElse: { newValue: 1 } });
        assert.deepEqual(store.toJSON(), createDefaults());
    });
});

describe("settings migration", () => {
    const legacyRecord = {
        id: "settings-id",
        layout: "vertical",
        updateFrequency: 45,
        userStyle: "body { color: red }",
        someRemovedSetting: "ignore me",
    };

    it("copies known settings out of the legacy record", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        const result = await migrateSettings(store, area, async () => legacyRecord);

        assert.equal(result.migrated, true);
        assert.equal(result.count, 3);
        assert.equal(store.get("layout"), "vertical");
        assert.equal(store.get("updateFrequency"), 45);
        assert.equal(store.get("userStyle"), "body { color: red }");
    });

    it("does not carry over settings that no longer exist", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        await migrateSettings(store, area, async () => legacyRecord);
        assert.equal(area.data["setting.someRemovedSetting"], undefined);
    });

    it("marks itself done and does not run twice", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        await migrateSettings(store, area, async () => legacyRecord);
        assert.equal(area.data[MIGRATION_FLAG], true);

        let readAgain = false;
        const second = await migrateSettings(store, area, async () => {
            readAgain = true;
            return legacyRecord;
        });

        assert.equal(second.migrated, false);
        assert.equal(readAgain, false);
    });

    it("does not overwrite a newer value on a second run", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        await migrateSettings(store, area, async () => legacyRecord);
        await store.set("layout", "horizontal");
        await migrateSettings(store, area, async () => legacyRecord);

        assert.equal(store.get("layout"), "horizontal");
    });

    it("still completes when there is nothing to migrate", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        const result = await migrateSettings(store, area, async () => null);

        assert.equal(result.migrated, true);
        assert.equal(result.count, 0);
        assert.equal(area.data[MIGRATION_FLAG], true);
        assert.equal(store.get("layout"), "horizontal");
    });

    it("pickKnownSettings drops unknown and undefined entries", () => {
        const picked = pickKnownSettings({
            layout: "vertical",
            unknownThing: 1,
            userStyle: undefined,
        });
        assert.deepEqual(picked, { layout: "vertical" });
    });
});

/**
 * The view layer still calls the store the way it called the Backbone model it
 * replaced, so both Backbone spellings have to keep working.
 */
describe("settings store / Backbone call shapes", () => {
    it("save() accepts the object form used by the resizable layouts", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        store.save({ posB: 300, posC: 120 });
        await Promise.resolve();

        assert.equal(store.get("posB"), 300);
        assert.equal(store.get("posC"), 120);
        assert.equal(area.data["setting.posB"], 300);
    });

    it("save() still accepts the key/value form", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        store.save("layout", "vertical");
        await Promise.resolve();

        assert.equal(store.get("layout"), "vertical");
        assert.equal(area.data["setting.layout"], "vertical");
    });

    it("on() binds the context argument", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        const view = {
            seen: [] as string[],
            handler(this: { seen: string[] }, key: string) {
                this.seen.push(key);
            },
        };
        store.on("change:layout", view.handler, view);
        await store.set("layout", "vertical");

        assert.deepEqual(view.seen, ["layout"]);
    });

    it("off() removes a listener registered with a context", async () => {
        const area = fakeStorage();
        const store = createSettingsStore(area);
        await store.load();

        const view = {
            calls: 0,
            handler(this: { calls: number }) {
                this.calls += 1;
            },
        };
        store.on("change:layout", view.handler, view);
        store.off("change:layout", view.handler, view);
        await store.set("layout", "vertical");

        assert.equal(view.calls, 0);
    });
});
