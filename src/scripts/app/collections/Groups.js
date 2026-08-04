/**
 * @module App
 * @submodule collections/Groups
 */

import BB from "backbone";
import Group from "../models/Group.js";

/**
 * Collection of date groups
 * @class Groups
 * @constructor
 * @extends Backbone.Collection
 */
const Groups = BB.Collection.extend({
    model: Group,
});

export default Groups;
