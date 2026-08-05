/**
 * @module App
 * @submodule layouts/ContentLayout
 */

import Layout from "./Layout.js";
import ToolbarView from "../views/ToolbarView.js";
import contentView from "../views/contentView.js";
import SandboxView from "../views/SandboxView.js";
import { toolbars } from "../modules/data.js";

const toolbar = toolbars.findWhere({ region: "content" });

/**
 * Content layout view
 * @class ContentLayout
 * @constructor
 * @extends Layout
 */
const ContentLayout = Layout.extend({
    /**
     * View element
     * @property el
     * @default #content
     * @type HTMLElement
     */
    el: "#content",

    /**
     * @method initialize
     */
    initialize: function () {
        this.on("attach", function () {
            this.attach("toolbar", new ToolbarView({ model: toolbar }));
            this.attach("content", contentView);
            this.attach("sandbox", new SandboxView());
        });
    },
});

export default ContentLayout;
