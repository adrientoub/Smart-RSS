/**
 * @submodule collections/Sources
 */

import BB from "backbone";
import Source from "../models/Source.js";
import "../backboneDexie.ts";

/**
 * Collection of feed modules
 * @class Sources
 * @constructor
 * @extends Backbone.Collection
 */
export default BB.Collection.extend({
    model: Source,
    dexieTable: "sources",
    comparator: function (a, b) {
        const t1 = (a.get("title") || "").trim().toLowerCase();
        const t2 = (b.get("title") || "").trim().toLowerCase();
        return t1.localeCompare(t2);
    },
});
