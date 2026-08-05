import BB from "backbone";
import ContextMenu from "../views/ContextMenu.js";
import Locale from "../modules/Locale.js";
import { updateRecords, markItemsDeleted, idsOf } from "../../shared/dataClient.ts";
import { items } from "../modules/data.js";

const sourceContextMenu = new ContextMenu([
    {
        title: Locale.UPDATE,
        icon: "reload.png",
        action: function () {
            app.actions.execute("feeds:update");
        },
    },
    {
        title: Locale.MARK_ALL_AS_READ,
        icon: "read.png",
        action: function () {
            app.actions.execute("feeds:mark");
        },
    },
    {
        title: Locale.DELETE,
        icon: "delete.png",
        action: function () {
            app.actions.execute("feeds:delete");
        },
    },
    {
        title: Locale.REFETCH /**** Localization needed****/,
        icon: "save.png",
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
        icon: "properties.png",
        action: function () {
            app.actions.execute("feeds:showProperties");
        },
    },
]);

const trashContextMenu = new ContextMenu([
    {
        title: Locale.MARK_ALL_AS_READ,
        icon: "read.png",
        action: function () {
            const unread = items
                .where({ trashed: true, deleted: false })
                .filter((item) => item.get("unread") === true);
            updateRecords("items", idsOf(unread), { unread: false, visited: true });
        },
    },
    {
        title: Locale.EMPTY_TRASH,
        icon: "delete.png",
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
        icon: "reload.png",
        action: function () {
            app.actions.execute("feeds:updateAll");
        },
    },
    {
        title: Locale.MARK_ALL_AS_READ,
        icon: "read.png",
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
        icon: "delete.png",
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
        icon: "reload.png",
        action: function () {
            app.actions.execute("feeds:update");
        },
    },
    {
        title: Locale.MARK_ALL_AS_READ,
        icon: "read.png",
        action: function () {
            app.actions.execute("feeds:mark");
        },
    },
    {
        title: Locale.DELETE,
        icon: "delete.png",
        action: function () {
            app.actions.execute("feeds:delete");
        },
    },
    {
        title: Locale.PROPERTIES,
        icon: "properties.png",
        action: function () {
            app.actions.execute("feeds:showProperties");
        },
    },
]);

const itemsContextMenu = new ContextMenu([
    {
        title: Locale.NEXT_UNREAD + " (H)",
        icon: "forward.png",
        action: function () {
            app.actions.execute("articles:nextUnread");
        },
    },
    {
        title: Locale.PREV_UNREAD + " (Y)",
        icon: "back.png",
        action: function () {
            app.actions.execute("articles:prevUnread");
        },
    },
    {
        title: Locale.MARK_AS_READ + " (K)",
        icon: "read.png",
        action: function () {
            app.actions.execute("articles:mark");
        },
    },
    {
        title: Locale.MARK_AND_NEXT_UNREAD + " (G)",
        icon: "find_next.png",
        action: function () {
            app.actions.execute("articles:markAndNextUnread");
        },
    },
    {
        title: Locale.MARK_AND_PREV_UNREAD + " (T)",
        icon: "find_previous.png",
        action: function () {
            app.actions.execute("articles:markAndPrevUnread");
        },
    },
    {
        title: Locale.FULL_ARTICLE,
        icon: "full_article.png",
        action: function (e) {
            app.actions.execute("articles:fullArticle", e);
        },
    },
    {
        title: Locale.PIN + " (P)",
        icon: "pinsource_context.png",
        action: function () {
            app.actions.execute("articles:pin");
        },
    },
    {
        title: Locale.DELETE + " (D)",
        icon: "delete.png",
        action: function (e) {
            app.actions.execute("articles:delete", e);
        },
    },
    {
        title: Locale.UNDELETE + " (N)",
        id: "context-undelete",
        icon: "undelete.png",
        action: function () {
            app.actions.execute("articles:undelete");
        },
    },
]);

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
