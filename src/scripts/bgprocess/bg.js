/**
 * @module BgProcess
 */

import Animation from "./modules/Animation.js";
import Settings from "./models/Settings.js";
import Info from "./models/Info.js";
import Source from "./models/Source.js";
import Sources from "./collections/Sources.js";
import Item from "./models/Item.js";
import Items from "./collections/Items.js";
import Folders from "./collections/Folders.js";
import Loader from "./models/Loader.js";
import Folder from "./models/Folder.js";
import Toolbars from "./collections/Toolbars.js";
import actionApi from "./modules/actionApi.js";
import { handleMessages } from "../shared/messages.ts";

const { action } = actionApi;

/**
 * Messages
 */
function addSource(address) {
    address = address.replace(/^feed:/i, "https:");

    const duplicate = sources.findWhere({ url: address });

    if (duplicate) {
        duplicate.trigger("change");
        openRSS(false, duplicate.get("id"));
        return;
    }
    const source = sources.create(
        {
            title: address,
            url: address,
        },
        { wait: true }
    );
    openRSS(false, source.get("id"));
}

const SUBSCRIBE_LINK_MENU_ID = "smart-rss-subscribe-link";

function createLinksMenu() {
    if (!getBoolean("displaySubscribeToLink")) {
        return;
    }
    browser.contextMenus.create({
        id: SUBSCRIBE_LINK_MENU_ID,
        title: "Subscribe to this feed",
        contexts: ["link"],
        checked: false,
    });
}

// MV3 removed the per-item `onclick` property, so menu clicks are routed here.
browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === SUBSCRIBE_LINK_MENU_ID) {
        addSource(info.linkUrl);
    }
});

handleMessages({
    "load-all": () => {
        loader.downloadAll(true);
    },
    "new-rss": ({ url }) => {
        if (url) {
            addSource(url);
        }
    },
    // Sources cross the boundary as ids, since Backbone models are not cloneable.
    "download-sources": ({ ids }) => {
        const models = ids
            .map((id) => sources.get(id) ?? folders.get(id))
            .filter((model) => Boolean(model));
        loader.download(models);
    },
    "abort-downloads": () => {
        loader.abortDownloading();
    },
    "get-setting": ({ key }) => settings.get(key),
    "save-setting": ({ key, value }) => {
        settings.save(key, value);
        return settings.get(key);
    },
    "get-settings": () => settings.attributes,
});

function openRSS(closeIfActive, focusSource) {
    const url = browser.runtime.getURL("rss.html");
    browser.tabs.query({ url: url }, (tabs) => {
        if (tabs[0]) {
            if (tabs[0].active && closeIfActive) {
                browser.tabs.remove(tabs[0].id);
                return;
            }
            browser.tabs.update(tabs[0].id, {
                active: true,
            });
            if (focusSource) {
                window.sourceToFocus = focusSource;
            }
            return;
        }
        window.sourceToFocus = focusSource;
        if (settings.get("openInNewTab")) {
            browser.tabs.create(
                {
                    url: url,
                },
                () => {}
            );
        } else {
            browser.tabs.update({ url: url });
        }
    });
}

function openInNewTab() {
    browser.tabs.create(
        {
            url: browser.runtime.getURL("rss.html"),
        },
        () => {}
    );
}

action.onClicked.addListener(function (tab, onClickData) {
    if (typeof onClickData !== "undefined") {
        if (onClickData.button === 1) {
            openInNewTab();
            return;
        }
    }
    openRSS(true);
});

window.openRSS = openRSS;

/**
 * Update animations
 */
Animation.start();

/**
 * Items
 */
window.Source = Source;
window.Item = Item;
window.Folder = Folder;

/**
 * DB models
 */
window.settings = new Settings();
window.info = new Info();
window.sources = new Sources();
window.items = new Items();
window.folders = new Folders();
window.loaded = false;

/**
 * This is used for when new feed is subscribed and smart rss tab is opened to focus the newly added feed
 */
window.sourceToFocus = null;

window.toolbars = new Toolbars();

window.loader = new Loader();

window.valueToBoolean = function (value) {
    if (
        value === 1 ||
        value === "1" ||
        value === "on" ||
        value === "yes" ||
        value === "true" ||
        value === true
    ) {
        return true;
    }
    if (
        value === 0 ||
        value === "0" ||
        value === "off" ||
        value === "no" ||
        value === "false" ||
        value === false
    ) {
        return false;
    }
    return value;
};

window.getBoolean = function (name) {
    return valueToBoolean(settings.get(name));
};

window.getElementBoolean = function (element, setting) {
    const elementValue = element.get(setting);
    if (elementValue === "global") {
        return getBoolean(setting);
    }
    return valueToBoolean(elementValue);
};

window.getElementSetting = function (element, setting) {
    const elementSetting = element.get(setting);
    return elementSetting === "global" || elementSetting === "USE_GLOBAL"
        ? settings.get(setting)
        : elementSetting;
};

function fetchOne(tasks) {
    return new Promise((resolve) => {
        if (tasks.length === 0) {
            resolve(true);
            return;
        }
        const oneTask = tasks.shift();
        oneTask.then(() => resolve(fetchOne(tasks))).catch(() => resolve(fetchOne(tasks)));
    });
}

function fetchAll() {
    const tasks = [];
    tasks.push(settings.fetch({ silent: true }));
    tasks.push(folders.fetch({ silent: true }));
    tasks.push(sources.fetch({ silent: true }));
    tasks.push(toolbars.fetch({ silent: true }));
    tasks.push(items.fetch({ silent: true }));

    return fetchOne(tasks);
}

window.fetchAll = fetchAll;
window.fetchOne = fetchOne;
window.reloadExt = function () {
    browser.runtime.reload();
};

window.appStarted = new Promise((resolve) => {
    /**
     * Init
     */

    fetchAll().then(function () {
        window.items.sort();
        /**
         * Load counters for specials
         */
        info.refreshSpecialCounters();

        /**
         * Set events
         */

        sources.on("add", function (source) {
            loader.download(source);
        });

        sources.on("change:url", function (source) {
            loader.download(source);
        });

        sources.on("change:title", function (source) {
            if (!source.get("title")) {
                loader.download(source);
            }
            sources.sort();
        });

        sources.on("change:hasNew", Animation.handleIconChange);
        settings.on("change:icon", Animation.handleIconChange);

        info.setEvents(sources);

        /**
         * Init
         */

        const version = settings.get("version") || 0;
        if (version < 1) {
            items.forEach((item) => {
                item.save("id", item.get("id") + item.get("sourceID"));
            });
            settings.save("version", 1);
        }

        browser.alarms.create("scheduler", {
            periodInMinutes: 1,
        });

        browser.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === "scheduler") {
                if (!settings.get("disableAutoUpdate")) {
                    loader.downloadAll();
                }
                const trashCleaningDelay = settings.get("autoremovetrash");
                if (trashCleaningDelay === 0) {
                    return;
                }
                const now = Date.now();
                const trashCleaningDelayInMs = trashCleaningDelay * 1000 * 60 * 60 * 24;
                items.where({ trashed: true, deleted: false }).forEach((item) => {
                    if (now - item.get("trashedOn") > trashCleaningDelayInMs) {
                        item.markAsDeleted();
                    }
                });
            }
        });

        /**
         * onclick:button -> open RSS
         */
        createLinksMenu();

        // The menu used to be rebuilt on every page visit as a side effect of feed
        // detection, which is how toggling this setting took effect. Rebuild explicitly.
        settings.on("change:displaySubscribeToLink", () => {
            Promise.resolve(browser.contextMenus.removeAll()).then(createLinksMenu);
        });

        /**
         * Set icon
         */
        Animation.stop();
        window.loaded = true;
        resolve(true);
    });
});
