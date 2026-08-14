/**
 * Date headers for the article list ("Today", "Yesterday", "Last week", ...).
 *
 * Only the title is used; the old model also carried a synthetic sort date,
 * which the row model no longer needs because the items are already ordered.
 */
import dateUtils from "./dateUtils.js";
import { translate } from "../../shared/i18n.ts";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
];

/** "Today" moves at midnight, so the reference day is only cached briefly. */
let today: Date | null = null;
let todayDays: number | null = null;
let todayWeek: number | null = null;

function referenceDate(): Date {
    if (!today) {
        today = new Date();
        todayDays = dateUtils.getDaysSinceEpoch(today);
        todayWeek = dateUtils.getWeekOfYear(today);
        setTimeout(() => {
            today = null;
            todayDays = null;
            todayWeek = null;
        }, 10000);
    }
    return today;
}

export function dateGroupTitle(date: number | Date): string {
    const current = referenceDate();
    const itemDate = new Date(date);
    const difference = dateUtils.getDaysSinceEpoch(itemDate) - todayDays;

    if (difference >= 0) {
        return translate("TODAY").toUpperCase();
    }
    if (difference === -1) {
        return translate("YESTERDAY").toUpperCase();
    }

    const itemWeek = dateUtils.getWeekOfYear(itemDate);
    if (itemWeek === todayWeek && difference >= -7) {
        return translate(DAYS[itemDate.getDay()]).toUpperCase();
    }
    if (itemWeek + 1 === todayWeek && difference >= -14) {
        return translate("LAST_WEEK").toUpperCase();
    }
    if (
        itemDate.getMonth() === current.getMonth() &&
        itemDate.getFullYear() === current.getFullYear()
    ) {
        return translate("EARLIER_THIS_MONTH").toUpperCase();
    }
    if (itemDate.getFullYear() === current.getFullYear()) {
        return translate(MONTHS[itemDate.getMonth()]).toUpperCase();
    }
    return String(itemDate.getFullYear());
}
