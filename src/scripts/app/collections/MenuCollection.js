/**
 * @module App
 * @submodule collections/MenuCollection
 */

import BB from "backbone";
import MenuItem from "../models/MenuItem.js";

/**
 * Each ContextMenu has its own MenuCollection instance
 * @class MenuCollection
 * @constructor
 * @extends Backbone.Collection
 */
const MenuCollection = BB.Collection.extend({
    model: MenuItem,
});

export default MenuCollection;
