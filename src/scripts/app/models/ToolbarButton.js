/**
 * @module App
 * @submodule models/ToolbarButton
 */

import BB from "backbone";

/**
 * Button model for toolbars
 * @class ToolbarButton
 * @constructor
 * @extends Backbone.Model
 */
const ToolbarButton = BB.Model.extend({
    defaults: {
        /**
         * @attribute actionName
         * @type String
         * @default global:default
         */
        actionName: "global:default",

        /**
         * Is button aligned to left or right?
         * @attribute position
         * @type String
         * @default left
         */
        position: "left",
    },
});

export default ToolbarButton;
