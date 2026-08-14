/**
 * Context menu contents. Plain definitions; the view renders whichever menu the
 * UI state names.
 */
import { translate } from "../../shared/i18n.ts";
import { settingsStore } from "../../shared/settings.ts";
import { idsOf, markItemsDeleted, updateRecords } from "../../shared/dataClient.ts";
import { items } from "../state/data.ts";
import { ui } from "../state/uiState.ts";
import { executeAction } from "../actions.ts";

const settings = settingsStore();
const L = (key: string) => translate(key);

export interface MenuItemDefinition {
    id?: string;
    title: string | (() => string);
    icon?: string;
    /** Evaluated when the menu opens. */
    hidden?: () => boolean;
    action: (event: MouseEvent) => void;
}

const run = (name: string) => (event: MouseEvent) => {
    executeAction(name, event);
};

const trashedItems = () => items.where({ trashed: true, deleted: false });

export const contextMenus: Record<string, MenuItemDefinition[]> = {
    source: [
        { title: L("UPDATE"), icon: "refresh", action: run("feeds:update") },
        { title: L("MARK_ALL_AS_READ"), icon: "check-all", action: run("feeds:mark") },
        { title: L("DELETE"), icon: "trash", action: run("feeds:delete") },
        { title: L("REFETCH"), icon: "download", action: run("feeds:refetch") },
        { title: L("OPENHOME"), action: run("feeds:openHome") },
        { title: L("PROPERTIES"), icon: "info", action: run("feeds:showProperties") },
    ],

    folder: [
        { title: L("UPDATE"), icon: "refresh", action: run("feeds:update") },
        { title: L("MARK_ALL_AS_READ"), icon: "check-all", action: run("feeds:mark") },
        { title: L("DELETE"), icon: "trash", action: run("feeds:delete") },
        { title: L("PROPERTIES"), icon: "info", action: run("feeds:showProperties") },
    ],

    allFeeds: [
        { title: L("UPDATE_ALL"), icon: "refresh", action: run("feeds:updateAll") },
        {
            title: L("MARK_ALL_AS_READ"),
            icon: "check-all",
            action: () => {
                if (confirm(L("MARK_ALL_QUESTION"))) {
                    updateRecords("items", idsOf(items.all()), { unread: false, visited: true });
                }
            },
        },
        {
            title: L("DELETE_ALL_ARTICLES"),
            icon: "trash",
            action: () => {
                if (confirm(L("DELETE_ALL_Q"))) {
                    markItemsDeleted(idsOf(items.filter((item) => item.deleted !== true)));
                }
            },
        },
    ],

    trash: [
        {
            title: L("RESTORE_ALL_ARTICLES"),
            icon: "undo",
            action: () => updateRecords("items", idsOf(trashedItems()), { trashed: false }),
        },
        {
            title: L("MARK_ALL_AS_READ"),
            icon: "check-all",
            action: () =>
                updateRecords("items", idsOf(trashedItems().filter((item) => item.unread)), {
                    unread: false,
                    visited: true,
                }),
        },
        {
            title: L("EMPTY_TRASH"),
            icon: "trash",
            action: () => {
                if (confirm(L("REALLY_EMPTY_TRASH"))) {
                    markItemsDeleted(idsOf(trashedItems()));
                }
            },
        },
    ],

    items: [
        {
            title: L("NEXT_UNREAD") + " (H)",
            icon: "chevron-down",
            action: run("articles:nextUnread"),
        },
        {
            title: L("PREV_UNREAD") + " (Y)",
            icon: "chevron-up",
            action: run("articles:prevUnread"),
        },
        { title: L("MARK_AS_READ") + " (K)", icon: "circle-check", action: run("articles:mark") },
        {
            title: L("MARK_AND_NEXT_UNREAD") + " (G)",
            icon: "check-down",
            action: run("articles:markAndNextUnread"),
        },
        {
            title: L("MARK_AND_PREV_UNREAD") + " (T)",
            icon: "check-up",
            action: run("articles:markAndPrevUnread"),
        },
        {
            title: L("FULL_ARTICLE"),
            icon: "external-link",
            action: run("articles:fullArticle"),
        },
        {
            id: "context-pin",
            title: L("PIN") + " (P)",
            icon: "pin",
            hidden: () => !settings.get("enablePin"),
            action: run("articles:pin"),
        },
        {
            id: "context-delete",
            title: () =>
                (ui().query.name === "trash" ? L("DELETE_PERMANENTLY") : L("DELETE")) + " (D)",
            icon: "trash",
            action: run("articles:delete"),
        },
        {
            id: "context-undelete",
            title: L("UNDELETE") + " (N)",
            icon: "undo",
            hidden: () => ui().query.name !== "trash",
            action: run("articles:undelete"),
        },
    ],
};
