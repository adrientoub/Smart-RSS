/**
 * @submodule collections/Items
 */

import BB from "backbone";
import Item from "../models/Item.js";
import "../backboneDexie.ts";
import { settingsStore } from "../settings.ts";

const settings = settingsStore();

/**
 * Built once. `localeCompare` without a cached collator can rebuild collation
 * data on every call, and this runs O(N log N) times per sort.
 *
 * "base" sensitivity makes case and accents equivalent, which is why the values
 * no longer need lowercasing first; "numeric" orders Episode 9 before Episode 10.
 */
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * Collection of feed modules
 * @class Items
 * @constructor
 * @extends Backbone.Collection
 */
const Items = BB.Collection.extend({
    model: Item,
    batch: false,
    dexieTable: "items",
    spaceship: function spaceship(val1, val2) {
        if (val1 === null || val2 === null || typeof val1 !== typeof val2) {
            return null;
        }
        if (typeof val1 === "string") {
            return collator.compare(val1, val2);
        } else {
            if (val1 > val2) {
                return 1;
            } else if (val1 < val2) {
                return -1;
            }
            return 0;
        }
    },
    comparator: function (a, b, sorting) {
        const sortBy = sorting ? settings.get("sortBy2") : settings.get("sortBy");
        const sortOrder = sorting ? settings.get("sortOrder2") : settings.get("sortOrder");

        const val = this.spaceship(String(a.get(sortBy)), String(b.get(sortBy)));

        if (val === 0) {
            return sorting ? 0 : this.comparator(a, b, true);
        }

        if (sortOrder === "desc") {
            return -val;
        }
        return val;
    },
    initialize: function () {
        this.listenTo(settings, "change:sortOrder", this.sort);
        this.listenTo(settings, "change:sortOrder2", this.sort);
        this.listenTo(settings, "change:sortBy", this.sort);
        this.listenTo(settings, "change:sortBy2", this.sort);
    },
});

export default Items;
