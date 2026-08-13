/**
 * Settings store backed by `browser.storage.local`.
 *
 * The old store kept settings in IndexedDB behind a hand-written sync adapter, with a single in-memory copy living in the background page. Every
 * other context had to reach into that copy through `getBackgroundPage()`,
 * which is why changing a setting needed the background at all.
 *
 * `storage.onChanged` fires in every extension context, so each context can keep
 * its own cache and stay coherent without any message passing.
 *
 * Each setting is stored under its own key rather than as one blob: two contexts
 * writing different settings at the same time would otherwise overwrite each
 * other through read-modify-write.
 */
import { createDefaults, type SettingKey, type Settings } from "./settingsSchema.ts";

const PREFIX = "setting.";

export interface StorageArea {
    get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
}

export interface StorageChange {
    oldValue?: unknown;
    newValue?: unknown;
}

type Listener = (key: SettingKey, value: unknown) => void;

/** Listeners may bind a context, as the old model-style API allowed. */
interface Binding {
    fn: Listener;
    context?: unknown;
}

const storageKey = (key: SettingKey) => PREFIX + key;
const settingKey = (key: string): SettingKey | null =>
    key.startsWith(PREFIX) ? (key.slice(PREFIX.length) as SettingKey) : null;

export function createSettingsStore(area: StorageArea, navigatorLanguage = "en") {
    const defaults = createDefaults(navigatorLanguage);
    let values: Settings = { ...defaults };
    const listeners = new Map<string, Set<Binding>>();

    function emit(event: string, key: SettingKey, value: unknown) {
        const bindings = listeners.get(event);
        if (!bindings) {
            return;
        }
        // Copied because handlers are allowed to unbind themselves.
        for (const { fn, context } of [...bindings]) {
            fn.call(context, key, value);
        }
    }

    function announce(key: SettingKey, value: unknown) {
        emit(`change:${key}`, key, value);
        emit("change", key, value);
    }

    return {
        defaults,

        get attributes(): Settings {
            return values;
        },

        /** Seeds the cache. Must resolve before any synchronous `get`. */
        async load(): Promise<void> {
            const stored = await area.get(null);
            const loaded = { ...defaults } as Record<string, unknown>;
            for (const [rawKey, value] of Object.entries(stored)) {
                const key = settingKey(rawKey);
                if (key && key in defaults) {
                    loaded[key] = value;
                }
            }
            values = loaded as Settings;
        },

        get<K extends SettingKey>(key: K): Settings[K] {
            return values[key];
        },

        async set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
            if (!(key in defaults)) {
                throw new Error(`Unknown setting: ${String(key)}`);
            }
            values = { ...values, [key]: value };
            announce(key, value);
            await area.set({ [storageKey(key)]: value });
        },

        async setMany(partial: Partial<Settings>): Promise<void> {
            const items: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(partial)) {
                if (!(key in defaults)) {
                    continue;
                }
                values = { ...values, [key]: value };
                items[storageKey(key as SettingKey)] = value;
                announce(key as SettingKey, value);
            }
            await area.set(items);
        },

        /**
         * Convenience alias; callers do not await it. Accepts both
         * `save("layout", "vertical")` and `save({ posB: 300 })`.
         */
        save(keyOrValues: SettingKey | Partial<Settings>, value?: unknown): void {
            const done =
                typeof keyOrValues === "string"
                    ? this.set(keyOrValues, value as Settings[SettingKey])
                    : this.setMany(keyOrValues);
            // Nothing awaits this, so a rejection would otherwise vanish.
            void done.catch((error) => console.error("Failed to save setting", error));
        },

        async clear(): Promise<void> {
            await area.remove(Object.keys(defaults).map((key) => storageKey(key as SettingKey)));
            const previous = values;
            values = { ...defaults };
            for (const key of Object.keys(defaults) as SettingKey[]) {
                if (previous[key] !== values[key]) {
                    announce(key, values[key]);
                }
            }
        },

        toJSON(): Settings {
            return { ...values };
        },

        on(event: string, listener: Listener, context?: unknown): void {
            const existing = listeners.get(event) ?? new Set<Binding>();
            existing.add({ fn: listener, context });
            listeners.set(event, existing);
        },

        off(event: string, listener?: Listener, context?: unknown): void {
            if (!listener) {
                listeners.delete(event);
                return;
            }
            const bindings = listeners.get(event);
            if (!bindings) {
                return;
            }
            for (const binding of [...bindings]) {
                if (
                    binding.fn === listener &&
                    (context === undefined || binding.context === context)
                ) {
                    bindings.delete(binding);
                }
            }
        },

        /**
         * Applies changes observed through `storage.onChanged`, including our own
         * writes. Unchanged values are ignored so a local write does not announce twice.
         */
        applyExternalChanges(changes: Record<string, StorageChange>): void {
            for (const [rawKey, change] of Object.entries(changes)) {
                const key = settingKey(rawKey);
                if (!key || !(key in defaults)) {
                    continue;
                }
                const next = "newValue" in change ? change.newValue : defaults[key];
                if (values[key] === next) {
                    continue;
                }
                values = { ...values, [key]: next } as Settings;
                announce(key, next);
            }
        },
    };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;

let instance: SettingsStore | null = null;

/** The store bound to `browser.storage.local`, created on first use. */
export function settingsStore(): SettingsStore {
    if (!instance) {
        instance = createSettingsStore(
            browser.storage.local as unknown as StorageArea,
            typeof navigator === "undefined" ? "en" : navigator.language
        );
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === "local") {
                instance?.applyExternalChanges(changes as Record<string, StorageChange>);
            }
        });
    }
    return instance;
}
