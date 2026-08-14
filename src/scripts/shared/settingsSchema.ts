/**
 * The settings schema: every key, its type, and its default.
 *
 * This replaces the `defaults` block of the old settings model. The old store
 * had no schema, which is why booleans ended up written as `true`, `"true"`,
 * `1`, `"1"`, `"on"` and `"yes"` and needed a `valueToBoolean` helper to read
 * back. Declaring types here removes that whole class of problem.
 */

import type { ThemePreference } from "./theme.ts";
import { availableLanguageCodes } from "./locales.ts";

export interface Hotkeys {
    [region: string]: { [combination: string]: string };
}

/** Locales that ship with the extension. */
export const AVAILABLE_LANGUAGES = availableLanguageCodes;

export function defaultLanguage(navigatorLanguage: string): string {
    const language = String(navigatorLanguage).split("-")[0];
    return (AVAILABLE_LANGUAGES as readonly string[]).includes(language) ? language : "en";
}

const DEFAULT_HOTKEYS: Hotkeys = {
    feeds: {
        up: "feeds:selectPrevious",
        down: "feeds:selectNext",
        u: "feeds:selectPrevious",
        j: "feeds:selectNext",

        "ctrl+left": "feeds:closeFolders",
        "ctrl+right": "feeds:openFolders",
        left: "feeds:toggleFolder",
        right: "feeds:showArticles",
        enter: "feeds:showAndFocusArticles",

        "shift+j": "feeds:selectNext",
        "shift+down": "feeds:selectNext",
        "shift+u": "feeds:selectPrevious",
        "shift+up": "feeds:selectPrevious",
    },
    articles: {
        d: "articles:delete",
        del: "articles:delete",
        "shift+d": "articles:delete",
        "shift+del": "articles:delete",
        "ctrl+f": "articles:focusSearch",
        "shift+enter": "articles:fullArticle",
        enter: "articles:fullArticle",
        k: "articles:mark",
        j: "articles:selectNext",
        down: "articles:selectNext",
        u: "articles:selectPrevious",
        up: "articles:selectPrevious",

        "shift+j": "articles:selectNext",
        "shift+down": "articles:selectNext",
        "shift+u": "articles:selectPrevious",
        "shift+up": "articles:selectPrevious",

        g: "articles:markAndNextUnread",
        t: "articles:markAndPrevUnread",
        h: "articles:nextUnread",
        y: "articles:prevUnread",
        z: "articles:prevUnread",

        "ctrl+shift+a": "articles:markAllAsRead",
        "ctrl+a": "articles:selectAll",
        p: "articles:pin",
        n: "articles:undelete",
        space: "articles:spaceThrough",
        r: "articles:update",

        pgup: "articles:pageUp",
        pgdown: "articles:pageDown",
        end: "articles:scrollToBottom",
        home: "articles:scrollToTop",
    },
    content: {
        up: "content:scrollUp",
        down: "content:scrollDown",
        space: "content:spaceThrough",
        pgup: "content:pageUp",
        pgdown: "content:pageDown",
        end: "content:scrollToBottom",
        home: "content:scrollToTop",
        del: "content:delete",
        d: "content:delete",
        k: "content:mark",

        g: "articles:markAndNextUnread",
        t: "articles:markAndPrevUnread",
        h: "articles:nextUnread",
        y: "articles:prevUnread",
        z: "articles:prevUnread",
        j: "articles:selectNext",
        u: "articles:selectPrevious",
    },
    sandbox: {
        del: "content:delete",
        d: "content:delete",
        k: "content:mark",
        space: "content:spaceThrough",

        g: "articles:markAndNextUnread",
        t: "articles:markAndPrevUnread",
        h: "articles:nextUnread",
        y: "articles:prevUnread",
        z: "articles:prevUnread",
        j: "articles:selectNext",
        u: "articles:selectPrevious",
    },
    global: {
        "shift+1": "feeds:focus",
        "shift+2": "articles:focus",
        "shift+3": "content:focus",
        "shift+4": "content:focusSandbox",
        esc: "global:hideOverlays",
    },
};

/**
 * Defaults are built per call so `lang` can follow the browser language on a
 * fresh profile without the module reading `navigator` at import time.
 */
export function createDefaults(navigatorLanguage = "en") {
    return {
        lang: defaultLanguage(navigatorLanguage),
        dateType: "normal", // normal = DD.MM.YYYY, ISO = YYYY-MM-DD, US = MM/DD/YYYY
        layout: "horizontal", // or vertical
        lines: "2", // one-line, two-lines
        // Panel sizes. The defaults are the original Opera-era "size,rest"
        // syntax, but resizing writes a plain pixel number.
        posA: "250,*" as string | number,
        posB: "350,*" as string | number,
        posC: "50%,*" as string | number,
        sortOrder: "asc",
        sortOrder2: "asc",
        icon: "orange",
        readOnVisit: true,
        askOnOpening: true,
        fullDate: true,
        hoursFormat: "24h",
        articleFontSize: "100",
        uiFontSize: "100",
        disableDateGroups: true,
        badgeMode: "disabled",
        circularNavigation: true,
        sortBy: "date",
        sortBy2: "title",
        askRmPinned: "trashed",
        titleIsLink: true,
        showSpinner: true,
        concurrentDownloads: 5,
        updateFrequency: 15, // in minutes
        disableAutoUpdate: true,
        openInNewTab: true,
        showFullHeadline: false,
        selectFirstArticle: false,
        selectAllFeeds: true,
        openEnclosure: false,
        autoremove: false,
        autoremovesetting: "KEEP_UNREAD",
        autoremovetrash: 0,
        openNewTab: "background",
        hotkeys: DEFAULT_HOTKEYS as Hotkeys,
        version: 1,
        showAllFeeds: true,
        showPinned: true,
        // Gates the whole pin feature: the Pinned special, the pin toggle in the
        // article list and the pin button in the article header.
        enablePin: false,
        showOnlyUnreadSources: false,
        feedListVisible: null as boolean | null,
        displayFaviconInsteadOfPin: false,
        queries: [] as string[],
        theme: "auto" as ThemePreference,
        defaultView: "feed",
        cacheParsedArticles: false,
        defaultToUnreadOnly: true,
        displaySubscribeToLink: true,
        systemNotifications: false,
    };
}

export type Settings = ReturnType<typeof createDefaults>;
export type SettingKey = keyof Settings;

export const SETTING_KEYS = Object.keys(createDefaults()) as SettingKey[];
