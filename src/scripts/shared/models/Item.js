/**
 * @submodule models/Item
 */

import BB from "backbone";
import { collections } from "../collectionRegistry.ts";

/**
 * Module for each article
 * @class Item
 * @constructor
 * @extends Backbone.Model
 */
const Item = BB.Model.extend({
    defaults: {
        title: "<no title>",
        author: "<no author>",
        url: "",
        date: 0,
        content: "No content loaded.",
        sourceID: -1,
        unread: true,
        visited: false,
        deleted: false,
        trashed: false,
        pinned: false,
        dateCreated: 0,
        enclosure: [],
        emptyDate: false,
        trashedOn: 0,
        parsedContent: {},
    },
    markAsDeleted: function () {
        this.save({
            trashed: true,
            deleted: true,
            visited: true,
            unread: false,
            enclosure: "",
            pinned: false,
            content: "",
            author: "",
            title: "",
            trashedOn: 0,
            parsedContent: {},
        });
    },
    trash: function () {
        this.save({
            trashed: true,
            visited: true,
            trashedOn: Date.now(),
        });
    },
    _source: null,
    getSource: function () {
        if (!this._source) {
            this._source = collections.sources.findWhere({ id: this.get("sourceID") });
        }
        return this._source;
    },
    query: function (o) {
        if (!o) {
            return true;
        }
        for (const i in o) {
            if (Object.hasOwn(o, i)) {
                if (this.get(i) !== o[i]) {
                    return false;
                }
            }
        }
        return true;
    },
});

export default Item;
