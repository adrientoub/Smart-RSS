/**
 * Per-element setting overrides.
 *
 * Settings themselves are typed since they moved to `storage.local`, but the
 * stored source and folder overrides are loose strings like `"global"`, `"1"`
 * or `"on"`, so reading one still needs coercion.
 */
import { settingsStore, type SettingsStore } from "./settings.ts";
import type { SettingKey } from "./settingsSchema.ts";

/** A source or folder record, read by attribute name. */
export type AttributeSource = object;

const read = (element: AttributeSource, key: string): unknown =>
    (element as Record<string, unknown>)[key];

export function valueToBoolean(value: unknown): unknown {
    if (
        value === 1 ||
        value === "1" ||
        value === "on" ||
        value === "yes" ||
        value === "true" ||
        value === true
    ) {
        return true;
    }
    if (
        value === 0 ||
        value === "0" ||
        value === "off" ||
        value === "no" ||
        value === "false" ||
        value === false
    ) {
        return false;
    }
    return value;
}

export function getElementBoolean(
    element: AttributeSource | null | undefined,
    setting: SettingKey,
    settings: SettingsStore = settingsStore()
): unknown {
    // A source can be missing briefly: it and its articles arrive as separate
    // messages. No override is available, so the global value applies.
    if (!element) {
        return settings.get(setting);
    }
    const elementValue = read(element, setting);
    if (elementValue === "global") {
        return settings.get(setting);
    }
    return valueToBoolean(elementValue);
}

// Unlike getElementBoolean this also treats "USE_GLOBAL" as global. Kept as-is:
// existing profiles hold both spellings.
export function getElementSetting(
    element: AttributeSource | null | undefined,
    setting: SettingKey,
    settings: SettingsStore = settingsStore()
): unknown {
    if (!element) {
        return settings.get(setting);
    }
    const elementSetting = read(element, setting);
    return elementSetting === "global" || elementSetting === "USE_GLOBAL"
        ? settings.get(setting)
        : elementSetting;
}
