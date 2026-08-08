/**
 * @module App
 * @submodule layouts/ContentLayout
 */

import Layout from "./Layout.js";
import ToolbarView from "../views/ToolbarView.ts";
import { toolbarItems } from "../staticdb/toolbarItems.ts";
import contentView from "../views/contentView.js";
import SandboxView from "../views/SandboxView.js";

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
            this.attach("toolbar", new ToolbarView({ actions: toolbarItems.content }));
            this.attach("content", contentView);
            this.attach("sandbox", new SandboxView());
        });
    },
});

export default ContentLayout;
