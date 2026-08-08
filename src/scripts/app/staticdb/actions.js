import stripTags from "../helpers/stripTags.js";
import L from "../modules/Locale.js";
import comm from "../controllers/comm.js";
import feedList from "../views/feedList.js";
import articleList from "../views/articleList.js";
import contentView from "../views/contentView.js";
import { sendMessage } from "../../shared/messages.ts";
import { settingsStore } from "../../shared/settings.ts";
import { prefersDarkScheme, resolveTheme, toggledTheme } from "../../shared/theme.ts";
import { sources, items, folders } from "../modules/data.js";
import {
    createRecord,
    updateRecords,
    destroyRecords,
    trashItems,
    markItemsDeleted,
    idsOf,
} from "../../shared/dataClient.ts";

const settings = settingsStore();

export default {
    global: {
        default: {
            title: L.UNKNOWN,
            fn: function () {
                alert(L.NO_ACTION);
            },
        },
        hideOverlays: {
            title: L.HIDE_OVERLAYS,
            fn: function () {
                comm.trigger("hide-overlays");
            },
        },
        openOptions: {
            title: L.OPTIONS,
            icon: "settings",
            fn: function () {
                browser.runtime.openOptionsPage();
            },
        },
    },
    feeds: {
        toggleFeedList: {
            icon: "panel-left",
            title: function () {
                const preference = settings.get("feedListVisible");
                return (preference ?? sources.length === 0)
                    ? L.HIDE_FEED_LIST
                    : L.SHOW_FEED_LIST;
            },
            fn: function () {
                app.feeds.toggleFeedList();
            },
        },
        toggleShowOnlyUnread: {
            icon: "filter",
            state: "showOnlyUnreadSources",
            title: L.TOGGLE_SHOW_ONLY_UNREAD,
            fn: function () {
                const currentUnread = settings.get("showOnlyUnreadSources");
                settings.save("showOnlyUnreadSources", !currentUnread);
            },
        },
        updateAll: {
            icon: "refresh",
            title: L.UPDATE_ALL,
            fn: function () {
                sendMessage("load-all");
            },
        },
        update: {
            icon: "refresh",
            title: L.UPDATE,
            fn: function () {
                const selectedItems = feedList.selectedItems;
                if (selectedItems.length) {
                    const ids = selectedItems.map((item) => item.model.id);
                    sendMessage("download-sources", { ids });
                }
            },
        },
        stopUpdate: {
            icon: "stop",
            title: L.STOP_UPDATE,
            fn: function () {
                sendMessage("abort-downloads");
            },
        },
        mark: {
            icon: "check-all",
            title: L.MARK_ALL_AS_READ,
            fn: function () {
                const selectedFeeds = feedList.getSelectedFeeds();
                if (!selectedFeeds.length) {
                    return;
                }

                const unread = items.filter(
                    (item) =>
                        item.get("unread") === true && selectedFeeds.indexOf(item.getSource()) >= 0
                );
                updateRecords("items", idsOf(unread), { unread: false, visited: true });

                const flagged = selectedFeeds.filter((source) => source.get("hasNew"));
                updateRecords("sources", idsOf(flagged), { hasNew: false });
            },
        },
        openHome: {
            title: L.OPEN_HOME,
            fn: function () {
                const selectedFeeds = feedList.getSelectedFeeds();
                if (!selectedFeeds.length) {
                    return;
                }
                selectedFeeds.forEach((source) => {
                    browser.tabs.create({
                        url: source.get("base"),
                        active: false,
                    });
                });
            },
        },
        refetch: {
            title: L.REFETCH,
            // Awaited so the refresh cannot re-insert articles that are still being dropped.
            fn: async function () {
                const selectedFeeds = feedList.getSelectedFeeds();
                if (!selectedFeeds.length) {
                    return;
                }
                const sourceIds = selectedFeeds.map((source) => source.get("id"));
                const stale = items.filter((item) => sourceIds.includes(item.get("sourceID")));
                await destroyRecords("items", idsOf(stale));
                app.actions.execute("feeds:update");
            },
        },
        delete: {
            icon: "trash",
            title: L.DELETE,
            fn: function () {
                if (!confirm(L.REALLY_DELETE)) {
                    return;
                }

                const feeds = feedList.getSelectedFeeds();
                const selectedFolders = feedList.getSelectedFolders();

                destroyRecords("sources", idsOf(feeds));
                destroyRecords("folders", idsOf(selectedFolders));
            },
        },
        showProperties: {
            icon: "info",
            title: L.PROPERTIES,
            fn: function () {
                const properties = app.feeds.properties;
                const feeds = feedList.getSelectedFeeds();
                const selectedFolders = feedList.getSelectedFolders();

                if (feedList.selectedItems.length === 1 && selectedFolders.length === 1) {
                    properties.show(selectedFolders[0]);
                } else if (!selectedFolders.length && feeds.length === 1) {
                    properties.show(feeds[0]);
                } else if (feeds.length > 0) {
                    properties.show(feeds);
                }
            },
        },
        addSource: {
            icon: "plus",
            title: L.ADD_RSS_SOURCE,
            // Awaited for the new feed's id, which is generated by the background.
            fn: async function () {
                let url = (prompt(L.RSS_FEED_URL) || "").trim();
                if (!url) {
                    return;
                }

                let folderID = "0";
                const list = feedList;
                if (
                    list.selectedItems.length &&
                    list.selectedItems[0].el.classList.contains("folder")
                ) {
                    const fid = list.selectedItems[0].model.get("id");
                    // make sure source is not added to folder which is not in db
                    if (folders.get(fid)) {
                        folderID = fid;
                    }
                }

                url = app.fixURL(url);
                const uid = url.replace(/^(.*:)?(\/\/)?(www*?\.)?/, "").replace(/\/$/, "");
                const duplicate = sources.findWhere({ uid: uid });

                if (!duplicate) {
                    const { id } = await createRecord("sources", {
                        title: url,
                        url: url,
                        updateEvery: -1,
                        folderID: folderID,
                    });
                    app.feeds.showFeedList();
                    app.trigger("focus-feed", id);
                } else {
                    app.feeds.showFeedList();
                    app.trigger("focus-feed", duplicate.get("id"));
                }
            },
        },
        addFolder: {
            icon: "folder-plus",
            title: L.NEW_FOLDER,
            fn: function () {
                const title = (prompt(L.FOLDER_NAME + ": ") || "").trim();
                if (!title) {
                    return;
                }

                createRecord("folders", { title: title });
            },
        },
        focus: {
            title: L.FOCUS_FEEDS,
            fn: function () {
                app.setFocus("feeds");
            },
        },
        selectNext: {
            title: L.SELECT_NEXT_FEED,
            fn: function (event) {
                feedList.selectNextSelectable(event);
            },
        },
        selectPrevious: {
            title: L.SELECT_PREVIOUS_FEED,
            fn: function (event) {
                feedList.selectPrev(event);
            },
        },
        closeFolders: {
            title: L.CLOSE_FOLDERS,
            fn: function (event) {
                const openFolders = Array.from(document.querySelectorAll(".folder.opened"));
                if (!openFolders.length) {
                    return;
                }
                openFolders.forEach((folder) => {
                    if (folder.view) {
                        folder.view.handleClickArrow(event);
                    }
                });
            },
        },
        openFolders: {
            title: L.OPEN_FOLDERS,
            fn: function (event) {
                const closedFolders = Array.from(document.querySelectorAll(".folder:not(.opened)"));
                closedFolders.forEach((folder) => {
                    if (folder.view) {
                        folder.view.handleClickArrow(event);
                    }
                });
            },
        },
        toggleFolder: {
            title: L.TOGGLE_FOLDER,
            fn: function (event) {
                event = event || {};
                const selectedItems = feedList.selectedItems;
                if (selectedItems.length && selectedItems[0].el.classList.contains("folder")) {
                    selectedItems[0].handleClickArrow(event);
                }
            },
        },
        showArticles: {
            title: L.SHOW_ARTICLES,
            fn: function (event = {}) {
                const target = event.target || {};
                const feeds = feedList.getSelectedFeeds();
                const feedIds = feeds.map((feed) => {
                    return feed.id;
                });
                let special = Array.from(document.querySelectorAll(".special.selected"))[0];
                if (special) {
                    special = special.view.model;
                }
                const folder = Array.from(document.querySelectorAll(".folder.selected"))[0];

                let unreadOnly = false;
                if (settings.get("defaultToUnreadOnly")) {
                    unreadOnly = true;
                }

                if (settings.get("showOnlyUnreadSources")) {
                    unreadOnly = true;
                }

                if (!!event.altKey || target.className === "source-counter") {
                    unreadOnly = !unreadOnly;
                }

                app.trigger("select:" + feedList.el.id, {
                    action: "new-select",
                    feeds: feedIds,
                    filter: special ? Object.assign({}, special.get("filter")) : null,
                    name: special ? special.get("name") : null,
                    multiple: !!(special || folder),
                    unreadOnly: unreadOnly,
                });

                if (special && special.get("name") === "all-feeds") {
                    const flagged = sources.filter((source) => source.get("hasNew"));
                    updateRecords("sources", idsOf(flagged), { hasNew: false });
                } else if (feedIds.length) {
                    const flagged = sources.filter(
                        (source) => source.get("hasNew") && feedIds.includes(source.id)
                    );
                    updateRecords("sources", idsOf(flagged), { hasNew: false });
                }
            },
        },
        showAndFocusArticles: {
            title: L.SHOW_AND_FOCUS_ARTICLES,
            fn: function (event) {
                event = event || {};
                const selectedItems = feedList.selectedItems;
                if (selectedItems.length) {
                    app.actions.execute("feeds:showArticles", event);
                    app.actions.execute("articles:focus");
                }
            },
        },
    },
    articles: {
        mark: {
            icon: "circle-check",
            title: L.MARK_AS_READ,
            fn: function () {
                articleList.changeUnreadState();
            },
        },
        toggleShowOnlyUnread: {
            icon: "filter",
            state: "defaultToUnreadOnly",
            title: L.DEFAULT_TO_UNREAD_ONLY,
            fn: function () {
                const currentUnread = settings.get("defaultToUnreadOnly");
                settings.save("defaultToUnreadOnly", !currentUnread);
            },
        },
        update: {
            icon: "refresh",
            title: L.UPDATE,
            fn: function () {
                const list = articleList;
                if (list.currentData.feeds.length) {
                    sendMessage("download-sources", { ids: list.currentData.feeds });
                } else {
                    sendMessage("load-all");
                }
            },
        },
        delete: {
            icon: "trash",
            title: () =>
                articleList.currentData.name === "trash" ? L.DELETE_PERMANENTLY : L.DELETE,
            fn: function (event) {
                const activeElement = document.activeElement;
                const toFocus = activeElement.closest(".region");
                const list = articleList;
                if (list.currentData.name === "trash" || event.shiftKey) {
                    if (!confirm(L.REMOVE_SELECTED_PERMANENTLY)) {
                        return;
                    }
                    list.destroyBatch(list.selectedItems, list.removeItemCompletely);
                } else {
                    list.destroyBatch(list.selectedItems, list.removeItem);
                }
                toFocus.focus();
            },
        },
        undelete: {
            icon: "undo",
            title: L.UNDELETE,
            fn: function () {
                if (
                    !articleList.selectedItems ||
                    !articleList.selectedItems.length ||
                    articleList.currentData.name !== "trash"
                ) {
                    return;
                }
                articleList.destroyBatch(articleList.selectedItems, articleList.undeleteItem);
            },
        },
        selectNext: {
            title: L.SELECT_NEXT_ARTICLE,
            fn: function (event) {
                articleList.selectNextSelectable(event);
            },
        },
        selectPrevious: {
            title: L.SELECT_PREVIOUS_ARTICLE,
            fn: function (event) {
                articleList.selectPrev(event);
            },
        },
        search: {
            title: L.SEARCH_TIP,
            fn: function (event) {
                event = event || {
                    currentTarget: document.querySelector("input[type=search]"),
                };
                let query = event.currentTarget.value || "";
                const list = articleList;
                if (query === "") {
                    list.setSearchFilter(null);
                    return;
                }

                let searchInContent = false;
                if (query[0] && query[0] === ":") {
                    query = query.replace(/^:/, "", query);
                    searchInContent = true;
                }
                const escape = (text) => String(text).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
                const expression = new RegExp(escape(query), "i");
                const selectedSpecial = document.querySelector(
                    ".sources-list-item.selected.special"
                );
                const strip = (text) =>
                    String(text)
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "");

                list.setSearchFilter(function (model) {
                    const sourceId = model.get("sourceID");
                    const sourceItem = document.querySelector('[data-id="' + sourceId + '"]');
                    // Out of the searched scope: left as it was, i.e. visible.
                    if (!sourceItem) {
                        return true;
                    }
                    if (!sourceItem.classList.contains("selected")) {
                        const folderId = sourceItem.view.model.get("folderID");
                        const folderItem = document.querySelector('[data-id="' + folderId + '"]');

                        if (!selectedSpecial && !folderItem) {
                            return true;
                        }
                    }

                    return (
                        expression.test(strip(model.get("title"))) ||
                        expression.test(strip(model.get("author"))) ||
                        (searchInContent && expression.test(strip(model.get("content"))))
                    );
                });
            },
        },
        focusSearch: {
            title: L.FOCUS_SEARCH,
            fn: function () {
                document.querySelector("input[type=search]").focus();
            },
        },
        focus: {
            title: L.FOCUS_ARTICLES,
            fn: function () {
                app.setFocus("articles");
            },
        },
        fullArticle: {
            title: L.FULL_ARTICLE,
            icon: "external-link",
            fn: function (event) {
                const list = app.articles.articleList;
                if (!list.selectedItems || !list.selectedItems.length) {
                    return;
                }
                if (list.selectedItems.length > 10 && settings.get("askOnOpening")) {
                    if (
                        !confirm(
                            "Do you really want to open " + list.selectedItems.length + " articles?"
                        )
                    ) {
                        return;
                    }
                }
                const openNewTab = settings.get("openNewTab");
                const active = openNewTab === "background" ? !!event.shiftKey : !event.shiftKey;
                list.selectedItems.forEach(function (item) {
                    browser.tabs.create({
                        url: stripTags(item.model.get("url")),
                        active: active,
                    });
                });
            },
        },
        oneFullArticle: {
            title: L.FULL_ARTICLE_SINGLE,
            fn: function (event) {
                event = event || {};
                const list = app.articles.articleList;
                let view;
                if ("currentTarget" in event) {
                    view = event.currentTarget.view;
                } else {
                    if (!list.selectedItems || !list.selectedItems.length) {
                        return;
                    }
                    view = list.selectedItems[0];
                }
                if (view.model) {
                    const openNewTab = settings.get("openNewTab");
                    const active = openNewTab === "background" ? !!event.shiftKey : !event.shiftKey;

                    browser.tabs.create({
                        url: stripTags(view.model.get("url")),
                        active: active,
                    });
                }
            },
        },
        markAndNextUnread: {
            title: L.MARK_AND_NEXT_UNREAD,
            icon: "check-down",
            fn: function () {
                articleList.changeUnreadState({
                    onlyToRead: true,
                });
                articleList.selectNextSelectable({
                    selectUnread: true,
                });
            },
        },
        markAndPrevUnread: {
            title: L.MARK_AND_PREV_UNREAD,
            icon: "check-up",
            fn: function () {
                articleList.changeUnreadState({
                    onlyToRead: true,
                });
                articleList.selectPrev({
                    selectUnread: true,
                });
            },
        },
        nextUnread: {
            title: L.NEXT_UNREAD,
            icon: "chevron-down",
            fn: function () {
                articleList.selectNextSelectable({
                    selectUnread: true,
                });
            },
        },
        prevUnread: {
            title: L.PREV_UNREAD,
            icon: "chevron-up",
            fn: function () {
                articleList.selectPrev({
                    selectUnread: true,
                });
            },
        },
        markAllAsRead: {
            title: L.MARK_ALL_AS_READ,
            icon: "check-all",
            fn: function () {
                const feeds = articleList.currentData.feeds;
                const filter = articleList.currentData.filter;
                const read = { unread: false, visited: true };

                if (feeds.length) {
                    const scope = filter ? items.where(filter) : items.toArray();
                    const unread = scope.filter(
                        (item) =>
                            item.get("unread") === true && feeds.indexOf(item.get("sourceID")) >= 0
                    );
                    updateRecords("items", idsOf(unread), read);
                } else if (articleList.currentData.name === "all-feeds") {
                    if (confirm(L.MARK_ALL_QUESTION)) {
                        const unread = items.filter((item) => item.get("unread") === true);
                        updateRecords("items", idsOf(unread), read);
                    }
                } else if (articleList.currentData.filter) {
                    updateRecords("items", idsOf(items.where(articleList.specialFilter)), read);
                }
            },
        },
        selectAll: {
            title: L.SELECT_ALL_ARTICLES,
            fn: function () {
                articleList.selectAll();
            },
        },
        pin: {
            title: L.PIN,
            icon: "pin",
            fn: function () {
                if (!settings.get("enablePin")) {
                    return;
                }
                if (!articleList.selectedItems || !articleList.selectedItems.length) {
                    return;
                }
                const isPinned = !articleList.selectedItems[0].model.get("pinned");
                const models = articleList.selectedItems.map((item) => item.model);
                updateRecords("items", idsOf(models), { pinned: isPinned });
            },
        },
        spaceThrough: {
            title: L.SPACE_THROUGH,
            fn: function () {
                if (!articleList.selectedItems || !articleList.selectedItems.length) {
                    return;
                }
                app.trigger("space-pressed");
            },
        },
        pageUp: {
            title: L.PAGE_UP,
            fn: function () {
                const el = articleList.el;
                el.scrollByPages(-1);
            },
        },
        pageDown: {
            title: L.PAGE_DOWN,
            fn: function () {
                const el = articleList.el;
                el.scrollByPages(1);
            },
        },
        scrollToBottom: {
            title: L.SCROLL_TO_BOTTOM,
            fn: function () {
                const el = articleList.el;
                el.scrollTop = el.scrollHeight;
            },
        },
        scrollToTop: {
            title: L.SCROLL_TO_TOP,
            fn: function () {
                const el = articleList.el;
                el.scrollTop = 0;
            },
        },
    },
    content: {
        changeView: {
            title: L.CHANGE_VIEW,
            icon: "newspaper",
            fn: function () {
                if (!contentView.model) {
                    return;
                }
                const view = contentView.view === "feed" ? "mozilla" : "feed";
                contentView.render(view);
            },
        },
        mark: {
            title: L.MARK_AS_READ,
            icon: "circle-check",
            fn: function () {
                if (!contentView.model) {
                    return;
                }
                updateRecords("items", idsOf(contentView.model), {
                    unread: !contentView.model.get("unread"),
                    visited: true,
                });
            },
        },
        undelete: {
            title: L.UNDELETE,
            icon: "undo",
            fn: function () {
                if (!contentView.model || !contentView.model.get("trashed")) {
                    return;
                }
                updateRecords("items", idsOf(contentView.model), { trashed: false });
            },
        },
        delete: {
            title: () =>
                contentView.model?.get("trashed") ? L.DELETE_PERMANENTLY : L.DELETE,
            icon: "trash",
            fn: function (e) {
                if (!contentView.model) {
                    return;
                }

                const askRmPinned = settings.get("enablePin")
                    ? settings.get("askRmPinned")
                    : "none";

                if (contentView.model.get("trashed") || e.shiftKey) {
                    if (
                        contentView.model.get("trashed") &&
                        !confirm(L.REMOVE_SELECTED_PERMANENTLY)
                    ) {
                        return;
                    }
                    if (contentView.model.get("pinned") && askRmPinned && askRmPinned !== "none") {
                        const conf = confirm(
                            L.translate("PINNED_DELETE_CONFIRM", {
                                title: contentView.model.get("title"),
                            })
                        );
                        if (!conf) {
                            return;
                        }
                    }
                    markItemsDeleted(idsOf(contentView.model));
                } else {
                    if (contentView.model.get("pinned") && askRmPinned === "all") {
                        const conf = confirm(
                            L.translate("PINNED_DELETE_CONFIRM", {
                                title: contentView.model.get("title"),
                            })
                        );
                        if (!conf) {
                            return;
                        }
                    }

                    trashItems(idsOf(contentView.model));
                }
            },
        },
        showConfig: {
            title: L.SETTINGS,
            icon: "settings",
            fn: async function () {
                const url = browser.runtime.getURL("options.html");
                const tabs = await browser.tabs.query({ url: url });
                if (!tabs[0]) {
                    await browser.tabs.create({ url: url });
                    return;
                }
                if (tabs[0].active) {
                    await browser.tabs.remove(tabs[0].id);
                    return;
                }
                await browser.tabs.update(tabs[0].id, { active: true });
            },
        },
        toggleTheme: {
            title: L.TOGGLE_THEME,
            icon: () =>
                resolveTheme(settings.get("theme"), prefersDarkScheme()) === "dark"
                    ? "moon"
                    : "sun",
            fn: function () {
                settings.save("theme", toggledTheme(settings.get("theme"), prefersDarkScheme()));
            },
        },
        focus: {
            title: L.FOCUS_CONTENT,
            fn: function () {
                app.setFocus("content");
            },
        },
        focusSandbox: {
            title: L.FOCUS_ARTICLE,
            fn: function () {
                app.content.sandbox.el.focus();
            },
        },
        scrollDown: {
            title: L.SCROLL_DOWN,
            fn: function () {
                const cw = document.querySelector("iframe").contentWindow;
                cw.scrollBy(0, 40);
            },
        },
        scrollUp: {
            title: L.SCROLL_UP,
            fn: function () {
                const cw = document.querySelector("iframe").contentWindow;
                cw.scrollBy(0, -40);
            },
        },
        spaceThrough: {
            title: L.SPACE_THROUGH,
            fn: function () {
                contentView.handleSpace();
            },
        },
        pageUp: {
            title: L.PAGE_UP,
            fn: function () {
                const cw = document.querySelector("iframe").contentWindow;
                const d = cw.document;
                cw.scrollBy(0, -d.documentElement.clientHeight * 0.85);
            },
        },
        pageDown: {
            title: L.PAGE_DOWN,
            fn: function () {
                const cw = document.querySelector("iframe").contentWindow;
                const d = cw.document;
                cw.scrollBy(0, d.documentElement.clientHeight * 0.85);
            },
        },
        scrollToBottom: {
            title: L.SCROLL_TO_BOTTOM,
            fn: function () {
                const cw = document.querySelector("iframe").contentWindow;
                const d = cw.document;
                cw.scrollTo(0, d.documentElement.offsetHeight);
            },
        },
        scrollToTop: {
            title: L.SCROLL_TO_TOP,
            fn: function () {
                const cw = document.querySelector("iframe").contentWindow;
                cw.scrollTo(0, 0);
            },
        },
    },
}; // end actions object
