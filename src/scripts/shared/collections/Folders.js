/**
 * @submodule collections/Folders
 */

import BB from "backbone";
import Folder from "../models/Folder.js";
import "../backboneDexie.ts";

/**
 * Collection of feed folders
 * @class Folders
 * @constructor
 * @extends Backbone.Collection
 */
export default BB.Collection.extend({
    model: Folder,
    dexieTable: "folders",
    comparator: function (a, b) {
        const t1 = (a.get("title") || "").trim().toLowerCase();
        const t2 = (b.get("title") || "").trim().toLowerCase();
        return t1 < t2 ? -1 : 1;
    },
});
