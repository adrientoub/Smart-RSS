/**
 * @module BgProcess
 */

import Animation from "./modules/Animation.ts";
import Loader from "./models/Loader.ts";
import { dataHandlers } from "./modules/dataApi.ts";
import { loadRepositories, sourceRepository } from "./modules/repositories.ts";
import { refreshCounters, startCounters } from "./modules/counters.ts";
import { startDataBroadcast } from "./modules/dataBroadcast.ts";
import { items, sources } from "../shared/stores.ts";
import { sourceDefaults } from "../shared/records.ts";
import { handleMessages, broadcast } from "../shared/messages.ts";
import { settingsStore } from "../shared/settings.ts";
import { translate } from "../shared/i18n.ts";

const { action } = browser;

const settings = settingsStore();

/**
 * The feed a newly opened reader should focus. A subscription can happen before
 * any reader exists, so the id is held until one asks for it.
 */
let sourceToFocus: string | null = null;

const loader = new Loader();

function addSource(address: string): void {
    address = address.replace(/^feed:/i, "https:");

    const duplicate = sources.findWhere({ url: address });
    if (duplicate) {
        void openRSS(false, duplicate.id);
        return;
    }
    const source = sourceRepository.create({ title: address, url: address });
    void openRSS(false, source.id);
}

const SUBSCRIBE_LINK_MENU_ID = "smart-rss-subscribe-link";

// Menus do not survive a worker restart, and creating one twice is an error.
async function createLinksMenu(): Promise<void> {
    await browser.contextMenus.removeAll();
    if (!settings.get("displaySubscribeToLink")) {
        return;
    }
    browser.contextMenus.create({
        id: SUBSCRIBE_LINK_MENU_ID,
        title: translate("SUBSCRIBE_TO_FEED"),
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
 * waits for the same init rather than assuming the stores are loaded.
 */
function whenStarted<T extends Record<string, (request: any) => unknown>>(handlers: T): T {
    return Object.fromEntries(
        Object.entries(handlers).map(([name, handler]) => [
            name,
            async (request: unknown) => {
                await appStarted;
                return handler(request);
            },
        ])
    ) as T;
}

handleMessages({
    // The UI waits on this instead of reaching for the background page.
    "background-ready": () => appStarted,
    ...whenStarted({
        "load-all": () => {
            loader.downloadAll(true);
        },
        "new-rss": ({ url }: { url: string }) => {
            if (url) {
                addSource(url);
            }
        },
        "download-sources": ({ ids }: { ids: string[] }) => {
            loader.download(ids);
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

async function openRSS(closeIfActive: boolean, focusSource?: string): Promise<void> {
    const url = browser.runtime.getURL("rss.html");
    const tabs = await browser.tabs.query({ url });
    if (tabs[0]) {
        if (tabs[0].active && closeIfActive) {
            await browser.tabs.remove(tabs[0].id);
            return;
        }
        await browser.tabs.update(tabs[0].id, { active: true });
        if (focusSource) {
            // The reader is already running, so it can be told directly.
            broadcast("focus-source", { id: focusSource });
        }
        return;
    }
    // No reader yet; it collects this once it starts.
    sourceToFocus = focusSource ?? null;
    if (settings.get("openInNewTab")) {
        await browser.tabs.create({ url });
    } else {
        await browser.tabs.update({ url });
    }
}

action.onClicked.addListener(async (tab, onClickData) => {
    await appStarted;
    if (onClickData?.button === 1) {
        await browser.tabs.create({ url: browser.runtime.getURL("rss.html") });
        return;
    }
    await openRSS(true);
});

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
    const maxAge = trashCleaningDelay * 1000 * 60 * 60 * 24;
    const expired = itemsToPurge(now, maxAge);
    if (expired.length) {
        dataHandlers["items-mark-deleted"]({ ids: expired });
    }
});

function itemsToPurge(now: number, maxAge: number): string[] {
    return items
        .where({ trashed: true, deleted: false })
        .filter((item) => now - item.trashedOn > maxAge)
        .map((item) => item.id);
}

/**
 * Re-creating an alarm restarts its period. The worker starts often enough in
 * MV3 that always creating it would keep pushing the next run out of reach.
 */
async function ensureScheduler(): Promise<void> {
    if (!(await browser.alarms.get(SCHEDULER_ALARM))) {
        browser.alarms.create(SCHEDULER_ALARM, { periodInMinutes: 1 });
    }
}

async function fetchAll(): Promise<void> {
    await settings.load();
    await loadRepositories();
    refreshCounters();
}

/**
 * A feed whose favicon was never fetched had its next attempt pushed a week out.
 * Clearing the expiry lets the next refresh try again.
 */
function repairFaviconExpiry(): void {
    if ((settings.get("version") ?? 0) >= 2) {
        return;
    }
    const stale = sources
        .where({ favicon: sourceDefaults.favicon })
        .filter((source) => source.faviconExpires > 0)
        .map((source) => source.id);
    sourceRepository.update(stale, { faviconExpires: 0 });
    settings.save("version", 2);
}

const appStarted = new Promise<true>((resolve, reject) => {
    fetchAll()
        .then(() => {
            // After the first load, so the whole fetch is not replayed record by
            // record, and outside fetchAll, which runs again on settings import.
            startDataBroadcast();
            startCounters();
            repairFaviconExpiry();

            // A new feed has nothing in it until it is downloaded once.
            sources.subscribe((change) => {
                if (change.reset) {
                    return;
                }
                const toDownload = change.added.map((source) => source.id);
                for (const { record, attrs } of change.changed) {
                    if ("url" in attrs || ("title" in attrs && !record.title)) {
                        toDownload.push(record.id);
                    }
                }
                if (toDownload.length) {
                    loader.download(toDownload);
                }
            });

            return ensureScheduler();
        })
        .then(() => {
            createLinksMenu();
            // The menu used to be rebuilt on every page visit as a side effect of
            // feed detection, which is how toggling this setting took effect.
            settings.on("change:displaySubscribeToLink", createLinksMenu);
            settings.on("change:lang", createLinksMenu);

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
