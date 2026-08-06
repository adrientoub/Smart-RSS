/**
 * @module App
 * @submodule layouts/FeedsLayout
 */

import Layout from "./Layout.js";
import ToolbarView from "../views/ToolbarView.js";
import feedList from "../views/feedList.js";
import Properties from "../views/Properties.js";
import resizable from "../mixins/resizable.js";
import IndicatorView from "../views/IndicatorView.js";
import { settingsStore } from "../../shared/settings.ts";
import { toolbars } from "../modules/data.js";

const settings = settingsStore();

const toolbar = toolbars.findWhere({ region: "feeds" });

/**
 * Feeds layout view
 * @class FeedsLayout
 * @constructor
 * @extends Layout
 */
let FeedsLayout = Layout.extend({
    /**
     * View element
     * @property el
     * @default #feeds
     * @type HTMLElement
     */
    el: "#feeds",

    /**
     * @method initialize
     */
    initialize: function () {
        this.on("attach", function () {
            this.attach("toolbar", new ToolbarView({ model: toolbar }));
            this.attach("properties", new Properties());
            this.attach("feedList", feedList);
            this.attach("indicator", new IndicatorView());
        });

        this.el.view = this;

        this.on("resize:after", this.handleResize);
        window.addEventListener("resize", this.handleResize.bind(this));

        this.enableResizing("horizontal", settings.get("posA"));
    },

    /**
     * Saves layout size
     * @method handleResize
     */
    handleResize: function () {
        const width = this.el.offsetWidth;
        settings.save({ posA: width });
    },
});

FeedsLayout = FeedsLayout.extend(resizable);

export default FeedsLayout;
