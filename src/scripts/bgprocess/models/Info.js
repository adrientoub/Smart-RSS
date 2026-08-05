/**
 * @module BgProcess
 * @submodule models/Info
 */

import BB from "backbone";
import animation from "../modules/Animation.js";
import actionApi from "../modules/actionApi.js";
import { settingsStore } from "../../shared/settings.ts";
import { collections } from "../../shared/collectionRegistry.ts";
import { applyCounts } from "../../shared/counters.ts";

const settings = settingsStore();

const { action } = actionApi;

const handleAllCountChange = function (model) {
    if (settings.get("badgeMode") === "disabled") {
        if (model === settings) {
            action.setBadgeText({ text: "" });
        }
        return;
    }

    if (model === settings) {
        if (settings.get("badgeMode") === "unread") {
            info.off("change:allCountUnvisited", handleAllCountChange);
            info.on("change:allCountUnread", handleAllCountChange);
        } else {
            info.off("change:allCountUnread", handleAllCountChange);
            info.on("change:allCountUnvisited", handleAllCountChange);
        }
    }
    if (info.badgeTimeout) {
        return;
    }

    info.badgeTimeout = setTimeout(function () {
        let val;
        if (settings.get("badgeMode") === "unread") {
            val = info.get("allCountUnread") > 99 ? "+" : info.get("allCountUnread");
        } else {
            val = info.get("allCountUnvisited") > 99 ? "+" : info.get("allCountUnvisited");
        }

        val = val <= 0 ? "" : String(val);
        action.setBadgeText({ text: val });
        action.setBadgeBackgroundColor({ color: "#777" });
        info.badgeTimeout = null;
    });
};

/**
 * This model stores info about count of read/unread/unvisited/total of all feeds and in trash
 * @class Info
 * @constructor
 * @extends Backbone.Model
 */
const Info = BB.Model.extend({
    defaults: {
        id: "info-id",
        allCountUnread: 0,
        allCountTotal: 0,
        allCountUnvisited: 0,
        trashCountUnread: 0,
        trashCountTotal: 0,
        pinnedCountUnread: 0,
        pinnedCountTotal: 0,
    },
    badgeTimeout: null,
    refreshSpecialCounters: function () {
        this.set(applyCounts(collections));
    },
    setEvents: function () {
        settings.on("change:badgeMode", handleAllCountChange);
        if (settings.get("badgeMode") === "unread") {
            info.on("change:allCountUnread", handleAllCountChange);
        } else if (settings.get("badgeMode") === "unvisited") {
            info.on("change:allCountUnvisited", handleAllCountChange);
        }
        handleAllCountChange();

        sources.on("destroy", function (source) {
            let trashUnread = 0;
            let trashAll = 0;
            let allUnvisited = 0;
            let pinnedAll = 0;
            let pinnedUnread = 0;
            items.where({ sourceID: source.get("id") }).forEach(function (item) {
                if (!item.get("deleted")) {
                    if (!item.get("visited")) {
                        allUnvisited++;
                    }
                    if (item.get("trashed")) {
                        trashAll++;
                    }
                    if (item.get("trashed") && item.get("unread")) {
                        trashUnread++;
                    }
                    if (item.get("pinned") && !item.get("trashed")) {
                        pinnedAll++;
                    }
                    if (item.get("pinned") && !item.get("trashed") && item.get("unread")) {
                        pinnedUnread++;
                    }
                }
                item.destroy();
            });

            info.set({
                allCountUnread: info.get("allCountUnread") - source.get("count"),
                allCountTotal: info.get("allCountTotal") - source.get("countAll"),
                allCountUnvisited: info.get("allCountUnvisited") - allUnvisited,
                trashCountUnread: info.get("trashCountUnread") - trashUnread,
                trashCountTotal: info.get("trashCountTotal") - trashAll,
                pinnedCountUnread: info.get("pinnedCountUnread") - pinnedUnread,
                pinnedCountTotal: info.get("pinnedCountAll") - pinnedAll,
            });

            if (source.get("folderID")) {
                const folder = folders.findWhere({
                    id: source.get("folderID"),
                });
                if (folder) {
                    folder.set({
                        count: folder.get("count") - source.get("count"),
                        countAll: folder.get("countAll") - source.get("countAll"),
                    });
                }
            }

            if (source.get("hasNew")) {
                animation.handleIconChange();
            }
        });

        items.on("change:unread", function (model) {
            const source = model.getSource();
            if (!model.previous("trashed")) {
                if (model.get("unread") === true) {
                    source.set({
                        count: source.get("count") + 1,
                    });
                } else {
                    source.set({
                        count: source.get("count") - 1,
                    });

                    if (source.get("count") === 0 && source.get("hasNew") === true) {
                        source.save("hasNew", false);
                    }
                }
            } else if (!model.get("deleted")) {
                info.set({
                    trashCountUnread: info.get("trashCountUnread") + (model.get("unread") ? 1 : -1),
                });
            }
        });

        items.on("change:trashed", function (model) {
            const source = model.getSource();
            if (model.get("unread") === true) {
                if (model.get("trashed") === true) {
                    source.set({
                        count: source.get("count") - 1,
                        countAll: source.get("countAll") - 1,
                    });

                    if (source.get("count") === 0 && source.get("hasNew") === true) {
                        source.save("hasNew", false);
                    }
                } else {
                    source.set({
                        count: source.get("count") + 1,
                        countAll: source.get("countAll") + 1,
                    });
                }

                if (!model.get("deleted")) {
                    info.set({
                        trashCountTotal:
                            info.get("trashCountTotal") + (model.get("trashed") ? 1 : -1),
                        trashCountUnread:
                            info.get("trashCountUnread") + (model.get("trashed") ? 1 : -1),
                    });
                }
            } else {
                source.set({
                    countAll: source.get("countAll") + (model.get("trashed") ? -1 : 1),
                });

                if (!model.get("deleted")) {
                    info.set({
                        trashCountTotal:
                            info.get("trashCountTotal") + (model.get("trashed") ? 1 : -1),
                    });
                }
            }

            if (!model.get("deleted")) {
                info.set({
                    pinnedCountTotal:
                        info.get("pinnedCountTotal") +
                        (model.get("trashed") ? -1 : 1) * (model.get("pinned") ? 1 : 0),
                    pinnedCountUnread:
                        info.get("pinnedCountUnread") +
                        (model.get("trashed") ? -1 : 1) * (model.get("pinned") ? 1 : 0),
                });
            }
        });

        items.on("change:deleted", function (model) {
            if (model.previous("trashed") === true) {
                info.set({
                    trashCountTotal: info.get("trashCountTotal") - 1,
                    trashCountUnread: !model.previous("unread")
                        ? info.get("trashCountUnread")
                        : info.get("trashCountUnread") - 1,
                });
            }
        });

        items.on("change:pinned", function (model) {
            const change = model.previous("pinned") ? -1 : 1;
            info.set({
                pinnedCountTotal: info.get("pinnedCountTotal") + change,
                pinnedCountUnread: !model.previous("unread")
                    ? info.get("pinnedCountUnread")
                    : info.get("pinnedCountUnread") + change,
            });
        });

        items.on("change:visited", function (model) {
            info.set({
                allCountUnvisited: info.get("allCountUnvisited") + (model.get("visited") ? -1 : 1),
            });
        });

        sources.on("change:count", function (source) {
            // SPECIALS
            info.set({
                allCountUnread:
                    info.get("allCountUnread") + source.get("count") - source.previous("count"),
            });

            // FOLDER
            if (!source.get("folderID")) {
                return;
            }

            const folder = folders.findWhere({
                id: source.get("folderID"),
            });
            if (!folder) {
                return;
            }

            folder.set({
                count: folder.get("count") + source.get("count") - source.previous("count"),
            });
        });

        sources.on("change:countAll", function (source) {
            // SPECIALS
            info.set({
                allCountTotal:
                    info.get("allCountTotal") +
                    source.get("countAll") -
                    source.previous("countAll"),
            });

            // FOLDER
            if (!source.get("folderID")) {
                return;
            }

            const folder = folders.findWhere({
                id: source.get("folderID"),
            });
            if (!folder) {
                return;
            }

            folder.set({
                countAll:
                    folder.get("countAll") + source.get("countAll") - source.previous("countAll"),
            });
        });

        sources.on("change:folderID", function (source) {
            let folder;
            if (source.get("folderID")) {
                folder = folders.findWhere({ id: source.get("folderID") });
                if (!folder) {
                    return;
                }

                folder.set({
                    count: folder.get("count") + source.get("count"),
                    countAll: folder.get("countAll") + source.get("countAll"),
                });
            }

            if (source.previous("folderID")) {
                folder = folders.findWhere({
                    id: source.previous("folderID"),
                });
                if (!folder) {
                    return;
                }

                folder.set({
                    count: Math.max(folder.get("count") - source.get("count"), 0),
                    countAll: Math.max(folder.get("countAll") - source.get("countAll"), 0),
                });
            }
        });
    },
});

export default Info;
