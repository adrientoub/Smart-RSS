/**
 * @module App
 * @submodule collections/ToolbarItems
 */

import BB from "backbone";
import ToolbarButton from "../models/ToolbarButton.js";

/**
 * Each ToolbarView has its own ToolbarItems instance
 * @class ToolbarItems
 * @constructor
 * @extends Backbone.Collection
 */
const ToolbarItems = BB.Collection.extend({
    model: ToolbarButton,

    comparator: function (firstItem, secondItem) {
        if (!firstItem.view || !secondItem.view) {
            return 0;
        }
        const firstRectangle = firstItem.view.el.getBoundingClientRect();
        const secondRectangle = secondItem.view.el.getBoundingClientRect();

        return firstRectangle.left > secondRectangle.left ? 1 : -1;
    },
});

export default ToolbarItems;
