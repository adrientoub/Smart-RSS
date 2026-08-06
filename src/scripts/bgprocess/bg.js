/**
 * @module BgProcess
 */

import Animation from "./modules/Animation.js";
import info from "./models/Info.js";
import Loader from "./models/Loader.js";
import { dataHandlers } from "./modules/dataApi.js";
import { createCollections, fetchCollections } from "../shared/dataStore.ts";
import { startDataBroadcast } from "./modules/dataBroadcast.js";
import { handleMessages, broadcast } from "../shared/messages.ts";
import { settingsStore } from "../shared/settings.ts";
import { migrateSettings } from "../shared/settingsMigration.ts";

const { action } = browser;

/**
 * Messages
 */
function addSource(address) {
    address = address.replace(/^feed:/i, "https:");

    const duplicate = collections.sources.findWhere({ url: address });

    if (duplicate) {
        duplicate.trigger("change");
        openRSS(false, duplicate.get("id"));
        return;
    }
    const source = collections.sources.create(
        {
            title: address,
            url: address,
        },
        { wait: true }
    );
    openRSS(false, source.get("id"));
}

const SUBSCRIBE_LINK_MENU_ID = "smart-rss-subscribe-link";

// Menus do not survive a worker restart, and creating one twice is an error.
async function createLinksMenu() {
    await browser.contextMenus.removeAll();
    if (!settings.get("displaySubscribeToLink")) {
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
browser.contextMenus.onClicked.addListener(async (menuInfo) => {
    if (menuInfo.menuItemId === SUBSCRIBE_LINK_MENU_ID) {
        await appStarted;
        addSource(menuInfo.linkUrl);
    }
});

/**
 * A worker is started for whichever event comes first, so every entry point
 * waits for the same init rather than assuming the collections are loaded.
 */
function whenStarted(handlers) {
    return Object.fromEntries(
        Object.entries(handlers).map(([name, handler]) => [
            name,
            async (request) => {
                await appStarted;
                return handler(request);
            },
        ])
    );
}

handleMessages({
    // The UI waits on this instead of reaching for the background page.
    "background-ready": () => appStarted,
    ...whenStarted({
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
                .map((id) => collections.sources.get(id) ?? collections.folders.get(id))
                .filter((model) => Boolean(model));
            loader.download(models);
        },
        "abort-downloads": () => {
            loader.abortDownloading();
        },
        "reload-background-data": () => fetchAll(),
        "take-source-to-focus": () => {
            const id = sourceToFocus;
            sourceToFocus = null;
            return { id };
        },
        ...dataHandlers,
    }),
});

async function openRSS(closeIfActive, focusSource) {
    const url = browser.runtime.getURL("rss.html");
    const tabs = await browser.tabs.query({ url: url });
    if (tabs[0]) {
        if (tabs[0].active && closeIfActive) {
            await browser.tabs.remove(tabs[0].id);
            return;
        }
        await browser.tabs.update(tabs[0].id, {
            active: true,
        });
        if (focusSource) {
            // The reader is already running, so it can be told directly.
            broadcast("focus-source", { id: focusSource });
        }
        return;
    }
    // No reader yet; it collects this once it starts.
    sourceToFocus = focusSource;
    if (settings.get("openInNewTab")) {
        await browser.tabs.create({ url: url });
    } else {
        await browser.tabs.update({ url: url });
    }
}

function openInNewTab() {
    return browser.tabs.create({ url: browser.runtime.getURL("rss.html") });
}

action.onClicked.addListener(async function (tab, onClickData) {
    await appStarted;
    if (typeof onClickData !== "undefined") {
        if (onClickData.button === 1) {
            await openInNewTab();
            return;
        }
    }
    await openRSS(true);
});

/**
 * DB models
 */
const settings = settingsStore();
const collections = createCollections();

/**
 * This is used for when new feed is subscribed and smart rss tab is opened to focus the newly added feed
 */
let sourceToFocus = null;

const loader = new Loader();

const SCHEDULER_ALARM = "scheduler";

// Registered here rather than after init: a worker started by the alarm only
// receives it if the listener is in place during the first turn.
browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SCHEDULER_ALARM) {
        return;
    }
    await appStarted;
    if (!settings.get("disableAutoUpdate")) {
        loader.downloadAll();
    }
    const trashCleaningDelay = settings.get("autoremovetrash");
    if (trashCleaningDelay === 0) {
        return;
    }
    const now = Date.now();
    const trashCleaningDelayInMs = trashCleaningDelay * 1000 * 60 * 60 * 24;
    collections.items.where({ trashed: true, deleted: false }).forEach((item) => {
        if (now - item.get("trashedOn") > trashCleaningDelayInMs) {
            item.markAsDeleted();
        }
    });
});

/**
 * Re-creating an alarm restarts its period. The worker starts often enough in
 * MV3 that always creating it would keep pushing the next run out of reach.
 */
async function ensureScheduler() {
    if (!(await browser.alarms.get(SCHEDULER_ALARM))) {
        browser.alarms.create(SCHEDULER_ALARM, { periodInMinutes: 1 });
    }
}

async function fetchAll() {
    await settings.load();
    await fetchCollections(collections);
}

const appStarted = new Promise((resolve, reject) => {
    /**
     * Init
     */

    // Settings move out of IndexedDB before anything reads them.
    migrateSettings(settings, browser.storage.local)
        .then(fetchAll)
        .then(function () {
            // After the first load, so the whole fetch is not replayed record by
            // record, and outside fetchAll, which runs again on settings import.
            startDataBroadcast(collections);

            collections.items.sort();
            /**
             * Load counters for specials
             */
            info.refreshSpecialCounters();

            /**
             * Set events
             */

            collections.sources.on("add", function (source) {
                loader.download(source);
            });

            collections.sources.on("change:url", function (source) {
                loader.download(source);
            });

            collections.sources.on("change:title", function (source) {
                if (!source.get("title")) {
                    loader.download(source);
                }
                collections.sources.sort();
            });

            collections.sources.on("change:hasNew", Animation.handleIconChange);
            settings.on("change:icon", Animation.handleIconChange);

            info.setEvents();

            /**
             * Init
             */

            const version = settings.get("version") || 0;
            if (version < 1) {
                collections.items.forEach((item) => {
                    item.save("id", item.get("id") + item.get("sourceID"));
                });
                settings.save("version", 1);
            }

            return ensureScheduler();
        })
        .then(function () {
            /**
             * onclick:button -> open RSS
             */
            createLinksMenu();
            // The menu used to be rebuilt on every page visit as a side effect of feed
            // detection, which is how toggling this setting took effect. Rebuild explicitly.
            settings.on("change:displaySubscribeToLink", createLinksMenu);

            /**
             * Set icon
             */
            Animation.stop();
            resolve(true);
        })
        // Without this the promise stays pending, and every page waiting on
        // "background-ready" hangs on a blank screen instead of failing.
        .catch((error) => {
            console.error("Smart RSS background failed to start", error);
            Animation.stop();
            reject(error);
        });
});
