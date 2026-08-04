/**
 * @module BgProcess
 * @submodule models/Toolbar
 */

import BB from "backbone";

/**
 * Region toolbar for buttons
 * @class Toolbar
 * @constructor
 * @extends Backbone.Model
 */
const Toolbar = BB.Model.extend({
    defaults: {
        /**
         * @attribute region
         * @type String
         * @default feeds
         */
        region: "feeds",

        /**
         * @attribute position
         * @type String
         * @default top
         */
        position: "top",

        /**
         * List of actions. Each action = one button/search on toolbar
         * @attribute actions
         * @type Array
         * @default []
         */
        actions: [],

        /**
         * Version of toolbar (if any default changes are made -> version++)
         * @attribute actions
         * @type Array
         * @default []
         */
        version: 1,
    },

    /**
     * @method initialize
     */
    initialize: function () {
        // ...
    },
});

export default Toolbar;
