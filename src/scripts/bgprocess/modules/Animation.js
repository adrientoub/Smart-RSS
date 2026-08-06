/**
 * @module BgProcess
 * @submodule modules/Animation
 */

import { settingsStore } from "../../shared/settings.ts";
import { collections } from "../../shared/collectionRegistry.ts";

const { action } = browser;
const settings = settingsStore();

/**
 * Handles animation of browser action button icon
 * @class Animation
 * @constructor
 * @extends Object
 */
const Animation = {
    i: 2,
    interval: null,
    update: function () {
        action.setIcon({
            path: "/images/reload_anim_" + this.i + ".png",
        });
        this.i++;
        if (this.i > 4) {
            this.i = 1;
        }
    },
    stop: function () {
        clearInterval(this.interval);
        this.interval = null;
        this.i = 1;
        this.handleIconChange();
    },
    start: function () {
        if (this.interval) {
            return;
        }
        this.interval = setInterval(() => {
            this.update();
        }, 400);
        this.update();
    },
    handleIconChange: function () {
        if (this.interval) {
            return;
        }
        const icon = settings.get("icon");
        if (collections.sources.findWhere({ hasNew: true }) && icon !== "disabled") {
            action.setIcon({
                path: "/images/icon19-" + icon + ".png",
            });
        } else {
            action.setIcon({
                path: "/images/icon19.png",
            });
        }
    },
};
export default Animation;
