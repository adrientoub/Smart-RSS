/**
 * @submodule models/Folder
 */

import BB from "backbone";

/**
 * Model for feed folders
 * @class Folder
 * @constructor
 * @extends Backbone.Model
 */
export default BB.Model.extend({
    defaults: {
        title: "<no title>",
        opened: false,
        count: 0, // unread
        countAll: 0,
    },
});
