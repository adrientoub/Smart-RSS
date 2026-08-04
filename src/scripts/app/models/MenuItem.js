/**
 * @module App
 * @submodule models/MenuItem
 */

import BB from "backbone";

/**
 * Context menu item
 * @class MenuItem
 * @constructor
 * @extends Backbone.Model
 */
const MenuItem = BB.Model.extend({
    defaults: {
        /**
         * @attribute title
         * @type String
         * @default '<no title>'
         */
        title: "<no title>",

        /**
         * Function to be called when user selects this item
         * @attribute action
         * @type function
         * @default null
         */
        action: null,
    },
});

export default MenuItem;
