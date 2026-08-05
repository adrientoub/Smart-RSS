/**
 * Per-element setting overrides.
 *
 * Settings themselves are typed since they moved to `storage.local`, but source
 * and folder attributes are still legacy Backbone values holding loose strings
 * like `"global"`, `"1"` or `"on"`, so reading one still needs coercion.
 */
import { settingsStore, type SettingsStore } from "./settings.ts";
import type { SettingKey } from "./settingsSchema.ts";

/** Anything with a Backbone-style attribute reader. */
export interface AttributeSource {
    get(key: string): unknown;
}

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
    element: AttributeSource,
    setting: SettingKey,
    settings: SettingsStore = settingsStore()
): unknown {
    const elementValue = element.get(setting);
    if (elementValue === "global") {
        return settings.get(setting);
    }
    return valueToBoolean(elementValue);
}

// Unlike getElementBoolean this also treats "USE_GLOBAL" as global. Kept as-is:
// existing profiles hold both spellings.
export function getElementSetting(
    element: AttributeSource,
    setting: SettingKey,
    settings: SettingsStore = settingsStore()
): unknown {
    const elementSetting = element.get(setting);
    return elementSetting === "global" || elementSetting === "USE_GLOBAL"
        ? settings.get(setting)
        : elementSetting;
}
