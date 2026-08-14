/**
 * Article date formatting, following the date/time settings.
 */
import dateUtils from "./dateUtils.js";
import type { SettingsStore } from "../../shared/settings.ts";

const DATE_FORMATS: Record<string, string> = {
    normal: "DD.MM.YYYY",
    iso: "YYYY-MM-DD",
    us: "MM/DD/YYYY",
};

const datePattern = (settings: SettingsStore) =>
    DATE_FORMATS[(settings.get("dateType") as string) || "normal"] ?? DATE_FORMATS.normal;

/** Long form, used by the article header. */
export function formatFullDate(date: number, settings: SettingsStore): string {
    const time = settings.get("hoursFormat") === "12h" ? "H:mm:ss a" : "hh:mm:ss";
    return dateUtils.formatDate(date, datePattern(settings) + " " + time);
}

/** Short form for a list row: time today, no year within this year. */
export function formatListDate(date: number, settings: SettingsStore): string {
    if (!date) {
        return date as unknown as string;
    }
    const pattern = datePattern(settings);
    const time = settings.get("hoursFormat") === "12h" ? "H:mm a" : "hh:mm";

    if (settings.get("fullDate")) {
        return dateUtils.formatDate(date, pattern + " " + time);
    }
    if (
        Math.floor(dateUtils.formatDate(date, "T") / 86400000) >=
        Math.floor(dateUtils.formatDate(Date.now(), "T") / 86400000)
    ) {
        return dateUtils.formatDate(date, time);
    }
    if (new Date(date).getFullYear() === new Date().getFullYear()) {
        return dateUtils.formatDate(date, pattern.replace(/\/?YYYY(?!-)/, ""));
    }
    return dateUtils.formatDate(date, pattern);
}
