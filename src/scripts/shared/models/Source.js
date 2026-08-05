/**
 * @submodule models/Source
 */

import BB from "backbone";

/**
 * Feed module
 * @class Source
 * @constructor
 * @extends Backbone.Model
 */
/** Obfuscation, not encryption. Exported so the UI can build the stored value. */
export function encodePassword(str) {
    if (!str) {
        return "";
    }
    let enc = "enc:";
    for (let i = 0; i < str.length; i++) {
        enc += String.fromCharCode(str.charCodeAt(i) + 13);
    }
    return enc;
}

export function decodePassword(str) {
    if (!str || str.indexOf("enc:") !== 0) {
        return str;
    }
    let dec = "";
    for (let i = 4; i < str.length; i++) {
        dec += String.fromCharCode(str.charCodeAt(i) - 13);
    }
    return dec;
}

const Source = BB.Model.extend({
    defaults: {
        title: "",
        url: "",
        base: "",
        updateEvery: -1, // in minutes, -1 to use global default
        lastChecked: 0,
        lastUpdate: 0,
        count: 0, // unread
        countAll: 0,
        username: "",
        password: "",
        hasNew: false,
        isLoading: false,
        autoremove: -1, // in days
        autoremovesetting: "USE_GLOBAL",
        proxyThroughFeedly: false,
        favicon: "/images/feed.png",
        faviconExpires: 0,
        errorCount: 0,
        lastArticle: 0,
        uid: "",
        openEnclosure: "global",
        folderID: "0",
        defaultView: "global",
        lastStatus: 200,
    },

    initialize: function () {
        this.set("isLoading", false);
    },

    getPass: function () {
        return decodePassword(this.get("password"));
    },
    setPass: function (str) {
        this.set("password", encodePassword(str));
    },
});

export default Source;
