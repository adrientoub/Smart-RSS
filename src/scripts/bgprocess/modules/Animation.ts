/**
 * @module BgProcess
 * @submodule modules/Animation
 *
 * Animates the browser action icon while feeds are downloading.
 */
import { settingsStore } from "../../shared/settings.ts";
import { sources } from "../../shared/stores.ts";

const { action } = browser;
const settings = settingsStore();

const Animation = {
    i: 2,
    interval: null as ReturnType<typeof setInterval> | null,

    update(): void {
        action.setIcon({ path: "/images/reload_anim_" + this.i + ".png" });
        this.i++;
        if (this.i > 4) {
            this.i = 1;
        }
    },

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.interval = null;
        this.i = 1;
        this.handleIconChange();
    },

    start(): void {
        if (this.interval) {
            return;
        }
        this.interval = setInterval(() => this.update(), 400);
        this.update();
    },

    handleIconChange(): void {
        if (this.interval) {
            return;
        }
        const icon = settings.get("icon");
        if (sources.findWhere({ hasNew: true }) && icon !== "disabled") {
            action.setIcon({ path: "/images/icon19-" + icon + ".png" });
        } else {
            action.setIcon({ path: "/images/icon19.png" });
        }
    },
};

export default Animation;
