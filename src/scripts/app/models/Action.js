/**
 * @module App
 * @submodule models/Action
 */

import BB from "backbone";

/**
 * Executable action. Actions are usually executed by shorcuts, buttons or context menus.
 * @class Action
 * @constructor
 * @extends Backbone.Model
 */
const Action = BB.Model.extend({
    /**
     * @property idAttribute
     * @type String
     * @default name
     */
    idAttribute: "name",
    defaults: {
        /**
         * @attribute name
         * @type String
         * @default global:default
         */
        name: "global:default",

        /**
         * Function to be called when action is executed
         * @attribute fn
         * @type function
         */
        fn: function () {
            return function () {};
        },

        /**
         * Name in the icon set, or a function returning one.
         * @attribute icon
         * @type String|Function
         */
        icon: null,

        /**
         * @attribute title
         * @type String
         * @default ''
         */
        title: "",
        state: null,
    },
});

export default Action;
