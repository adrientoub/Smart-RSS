/**
 * @module App
 * @submodule layouts/FeedsLayout
 */

import Layout from "./Layout.js";
import ToolbarView from "../views/ToolbarView.ts";
import { toolbarItems } from "../staticdb/toolbarItems.ts";
import feedList from "../views/feedList.js";
import Properties from "../views/Properties.js";
import resizable from "../mixins/resizable.js";
import IndicatorView from "../views/IndicatorView.js";
import { settingsStore } from "../../shared/settings.ts";
import { sources } from "../modules/data.js";

const settings = settingsStore();

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
            this.attach("toolbar", new ToolbarView({ actions: toolbarItems.feeds }));
            this.attach("properties", new Properties());
            this.attach("feedList", feedList);
            this.attach("indicator", new IndicatorView());
            this.applyFeedListVisibility();
        });

        this.el.view = this;

        this.on("resize:after", this.handleResize);
        window.addEventListener("resize", this.handleResize.bind(this));
        settings.on("change:feedListVisible", this.applyFeedListVisibility, this);

        this.enableResizing("horizontal", settings.get("posA"));
    },

    applyFeedListVisibility: function () {
        const preference = settings.get("feedListVisible");
        this.feedListVisible = preference ?? sources.length === 0;
        this.el.classList.toggle("feed-list-hidden", !this.feedListVisible);
        if (this.feedList) {
            this.feedList.el.hidden = !this.feedListVisible;
        }
        const indicatorHost = this.feedListVisible ? this.el : app.articles?.el;
        if (indicatorHost && this.indicator?.el.parentElement !== indicatorHost) {
            indicatorHost.appendChild(this.indicator.el);
        }
        if (this.resizer) {
            this.resizer.hidden = !this.feedListVisible;
            this.refreshResizePosition();
        }
    },

    toggleFeedList: function () {
        settings.save("feedListVisible", !this.feedListVisible);
    },

    showFeedList: function () {
        if (!this.feedListVisible) {
            settings.save("feedListVisible", true);
        }
    },

    /**
     * Saves layout size
     * @method handleResize
     */
    handleResize: function () {
        if (!this.feedListVisible) {
            return;
        }
        const width = this.el.offsetWidth;
        settings.save({ posA: width });
    },
});

FeedsLayout = FeedsLayout.extend(resizable);

export default FeedsLayout;
