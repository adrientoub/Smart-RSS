import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadAmd } from "./helpers/loadAmd.ts";

interface DateUtils {
    getWeekOfYear(date: Date): number;
    getDayOfYear(date: Date | number | string): number;
    getDaysSinceEpoch(date: Date | number | string): number;
    startOfDay(date: Date | number | string): number;
    startOfMonth(date: Date | number | string): number;
    startOfWeek(date: Date, firstDayOfWeekIndex?: number): Date;
    addDays(date: Date | number | string, days?: number): Date;
}

const dateUtils = loadAmd<DateUtils>("scripts/app/helpers/dateUtils.js");

describe("dateUtils", () => {
    it("computes ISO week numbers", () => {
        assert.equal(dateUtils.getWeekOfYear(new Date(2024, 0, 4)), 1);
        assert.equal(dateUtils.getWeekOfYear(new Date(2024, 5, 12)), 24);
    });

    it("computes the day of year", () => {
        assert.equal(dateUtils.getDayOfYear(new Date(2024, 0, 1)), 1);
        assert.equal(dateUtils.getDayOfYear(new Date(2024, 11, 31)), 366); // leap year
        assert.equal(dateUtils.getDayOfYear(new Date(2023, 11, 31)), 365);
    });

    it("startOfDay zeroes the time component", () => {
        const result = new Date(dateUtils.startOfDay(new Date(2024, 4, 17, 13, 45, 30, 500)));
        assert.equal(result.getHours(), 0);
        assert.equal(result.getMinutes(), 0);
        assert.equal(result.getSeconds(), 0);
        assert.equal(result.getMilliseconds(), 0);
        assert.equal(result.getDate(), 17);
    });

    it("startOfMonth returns the first of the month at midnight", () => {
        const result = new Date(dateUtils.startOfMonth(new Date(2024, 4, 17, 13, 45)));
        assert.equal(result.getDate(), 1);
        assert.equal(result.getMonth(), 4);
        assert.equal(result.getHours(), 0);
    });

    it("startOfWeek defaults to Monday", () => {
        // 2024-05-17 is a Friday.
        const result = dateUtils.startOfWeek(new Date(2024, 4, 17));
        assert.equal(result.getDay(), 1);
        assert.equal(result.getDate(), 13);
    });

    it("addDays crosses month boundaries", () => {
        const result = dateUtils.addDays(new Date(2024, 0, 31), 1);
        assert.equal(result.getMonth(), 1);
        assert.equal(result.getDate(), 1);
    });

    it("addDays defaults to a single day and accepts negatives", () => {
        assert.equal(dateUtils.addDays(new Date(2024, 4, 17)).getDate(), 18);
        assert.equal(dateUtils.addDays(new Date(2024, 4, 17), -2).getDate(), 15);
    });

    it("getDaysSinceEpoch is monotonic and one apart for consecutive days", () => {
        const a = dateUtils.getDaysSinceEpoch(new Date(2024, 4, 17));
        const b = dateUtils.getDaysSinceEpoch(new Date(2024, 4, 18));
        assert.equal(b - a, 1);
    });
});
