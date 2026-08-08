import BB from "backbone";
import ContextMenu from "../views/ContextMenu.js";
import Locale from "../modules/Locale.js";
import { updateRecords, markItemsDeleted, idsOf } from "../../shared/dataClient.ts";
import { items } from "../modules/data.js";
import { settingsStore } from "../../shared/settings.ts";

const settings = settingsStore();

const sourceContextMenu = new ContextMenu([
    {
        title: Locale.UPDATE,
        icon: "refresh",
        action: function () {
            app.actions.execute("feeds:update");
        },
    },
    {
        title: Locale.MARK_ALL_AS_READ,
        icon: "check-all",
        action: function () {
            app.actions.execute("feeds:mark");
        },
    },
    {
        title: Locale.DELETE,
        icon: "trash",
        action: function () {
            app.actions.execute("feeds:delete");
        },
    },
    {
        title: Locale.REFETCH /**** Localization needed****/,
        icon: "download",
        action: function () {
            app.actions.execute("feeds:refetch");
        },
    },
    {
        title: Locale.OPENHOME,
        action: function () {
            app.actions.execute("feeds:openHome");
        },
    },
    {
        title: Locale.PROPERTIES,
        icon: "info",
        action: function () {
            app.actions.execute("feeds:showProperties");
        },
    },
]);

const trashContextMenu = new ContextMenu([
    {
        title: Locale.RESTORE_ALL_ARTICLES,
        icon: "undo",
        action: function () {
            updateRecords("items", idsOf(items.where({ trashed: true, deleted: false })), {
                trashed: false,
            });
        },
    },
    {
        title: Locale.MARK_ALL_AS_READ,
        icon: "check-all",
        action: function () {
            const unread = items
                .where({ trashed: true, deleted: false })
                .filter((item) => item.get("unread") === true);
            updateRecords("items", idsOf(unread), { unread: false, visited: true });
        },
    },
    {
        title: Locale.EMPTY_TRASH,
        icon: "trash",
        action: function () {
            if (confirm(Locale.REALLY_EMPTY_TRASH)) {
                markItemsDeleted(idsOf(items.where({ trashed: true, deleted: false })));
            }
        },
    },
]);

const allFeedsContextMenu = new ContextMenu([
    {
        title: Locale.UPDATE_ALL,
        icon: "refresh",
        action: function () {
            app.actions.execute("feeds:updateAll");
        },
    },
    {
        title: Locale.MARK_ALL_AS_READ,
        icon: "check-all",
        action: function () {
            if (confirm(Locale.MARK_ALL_QUESTION)) {
                updateRecords("items", idsOf(items.toArray()), {
                    unread: false,
                    visited: true,
                });
            }
        },
    },
    {
        title: Locale.DELETE_ALL_ARTICLES,
        icon: "trash",
        action: function () {
            if (confirm(Locale.DELETE_ALL_Q)) {
                const alive = items.filter((item) => item.get("deleted") !== true);
                markItemsDeleted(idsOf(alive));
            }
        },
    },
]);

const folderContextMenu = new ContextMenu([
    {
        title: Locale.UPDATE,
        icon: "refresh",
        action: function () {
            app.actions.execute("feeds:update");
        },
    },
    {
        title: Locale.MARK_ALL_AS_READ,
        icon: "check-all",
        action: function () {
            app.actions.execute("feeds:mark");
        },
    },
    {
        title: Locale.DELETE,
        icon: "trash",
        action: function () {
            app.actions.execute("feeds:delete");
        },
    },
    {
        title: Locale.PROPERTIES,
        icon: "info",
        action: function () {
            app.actions.execute("feeds:showProperties");
        },
    },
]);

const itemsContextMenu = new ContextMenu([
    {
        title: Locale.NEXT_UNREAD + " (H)",
        icon: "chevron-down",
        action: function () {
            app.actions.execute("articles:nextUnread");
        },
    },
    {
        title: Locale.PREV_UNREAD + " (Y)",
        icon: "chevron-up",
        action: function () {
            app.actions.execute("articles:prevUnread");
        },
    },
    {
        title: Locale.MARK_AS_READ + " (K)",
        icon: "circle-check",
        action: function () {
            app.actions.execute("articles:mark");
        },
    },
    {
        title: Locale.MARK_AND_NEXT_UNREAD + " (G)",
        icon: "check-down",
        action: function () {
            app.actions.execute("articles:markAndNextUnread");
        },
    },
    {
        title: Locale.MARK_AND_PREV_UNREAD + " (T)",
        icon: "check-up",
        action: function () {
            app.actions.execute("articles:markAndPrevUnread");
        },
    },
    {
        title: Locale.FULL_ARTICLE,
        icon: "external-link",
        action: function (e) {
            app.actions.execute("articles:fullArticle", e);
        },
    },
    {
        title: Locale.PIN + " (P)",
        id: "context-pin",
        icon: "pin",
        action: function () {
            app.actions.execute("articles:pin");
        },
    },
    {
        title: Locale.DELETE + " (D)",
        id: "context-delete",
        icon: "trash",
        action: function (e) {
            app.actions.execute("articles:delete", e);
        },
    },
    {
        title: Locale.UNDELETE + " (N)",
        id: "context-undelete",
        icon: "undo",
        action: function () {
            app.actions.execute("articles:undelete");
        },
    },
]);

const applyPinVisibility = () => {
    const pinItem = itemsContextMenu.el.querySelector("#context-pin");
    if (pinItem) {
        pinItem.hidden = !settings.get("enablePin");
    }
};
settings.on("change:enablePin", applyPinVisibility);
applyPinVisibility();

export default new (BB.View.extend({
    list: {},
    initialize: function () {
        this.list = {
            source: sourceContextMenu,
            trash: trashContextMenu,
            folder: folderContextMenu,
            allFeeds: allFeedsContextMenu,
            items: itemsContextMenu,
        };
    },
    get: function (name) {
        if (name in this.list) {
            return this.list[name];
        }
        return null;
    },
}))();
