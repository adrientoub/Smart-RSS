/**
 * Factory for making instances of toolbar items
 * @module App
 * @submodule factories/ToolbarItemsFactory
 */

import ToolbarButtonView from "../views/ToolbarButtonView.js";
import ToolbarDynamicSpaceView from "../views/ToolbarDynamicSpaceView.js";
import ToolbarSearchView from "../views/ToolbarSearchView.js";

export default {
    /**
     * Returns instance of toolbar item
     * @method create
     * @param name {string}
     * @param itemModel {Object}
     * @returns ToolbarDynamicSpaceView|ToolbarSearchView|ToolbarButtonView
     */
    create: function (name, itemModel) {
        if (name === "dynamicSpace") {
            return new ToolbarDynamicSpaceView({ model: itemModel });
        } else if (name === "search") {
            return new ToolbarSearchView({ model: itemModel });
        } else {
            return new ToolbarButtonView({ model: itemModel });
        }
    },
};
