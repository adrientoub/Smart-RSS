/**
 * @module App
 * @submodule layouts/ArticlesLayout
 */

import Layout from "./Layout.js";
import ToolbarView from "../views/ToolbarView.ts";
import { toolbarItems } from "../staticdb/toolbarItems.ts";
import articleList from "../views/articleList.js";
import resizable from "../mixins/resizable.js";
import { settingsStore } from "../../shared/settings.ts";

const settings = settingsStore();

/**
 * Articles layout view
 * @class ArticlesLayout
 * @constructor
 * @extends Layout
 */
let ArticlesLayout = Layout.extend({
    el: "#articles",
    events: {
        mousedown: "handleMouseDown",
    },
    initialize: function () {
        this.el.view = this;

        this.on("attach", function () {
            this.attach("toolbar", new ToolbarView({ actions: toolbarItems.articles }));
            this.attach("articleList", articleList);
        });

        this.on("resize:after", this.handleResizeAfter);
    },

    /**
     * Saves the new layout size
     * @triggered after resize
     * @method handleResizeAfter
     */
    handleResizeAfter: function () {
        if (settings.get("layout") === "horizontal") {
            const width = this.el.offsetWidth;
            settings.save({ posB: width });
        } else {
            const height = this.el.offsetHeight;
            settings.save({ posC: height });
        }
    },
});

ArticlesLayout = ArticlesLayout.extend(resizable);

export default ArticlesLayout;
