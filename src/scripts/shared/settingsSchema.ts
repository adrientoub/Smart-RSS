/**
 * The settings schema: every key, its type, and its default.
 *
 * This replaces the `defaults` block of the old Backbone model. The old store
 * had no schema, which is why booleans ended up written as `true`, `"true"`,
 * `1`, `"1"`, `"on"` and `"yes"` and needed a `valueToBoolean` helper to read
 * back. Declaring types here removes that whole class of problem.
 */

export interface Hotkeys {
    [region: string]: { [combination: string]: string };
}

/** Locales that ship with the extension. */
export const AVAILABLE_LANGUAGES = [
    "en",
    "cs",
    "sk",
    "de",
    "tr",
    "pl",
    "ru",
    "hu",
    "nl",
    "fr",
    "pt",
    "hr",
] as const;

export function defaultLanguage(navigatorLanguage: string): string {
    const language = String(navigatorLanguage).split("-")[0];
    return (AVAILABLE_LANGUAGES as readonly string[]).includes(language) ? language : "en";
}

const DEFAULT_STYLE = `:root {

  --blue-40: #45a1ff;
  --blue-50: #0a84ff;
  --blue-50-a30: rgba(10, 132, 255, 0.3);
  --blue-60: #0060df;
  --blue-70: #003eaa;
  --blue-80: #002275;
  --blue-90: #000f40;

  --grey-10: #f9f9fa;
  --grey-20: #ededf0;
  --grey-30: #d7d7db;
  --grey-40: #b1b1b3;
  --grey-50: #737373;
  --grey-60: #4a4a4f;
  --grey-70: #38383d;
  --grey-80: #2a2a2e;
  --grey-90: #0c0c0d;

  --white: #fff;
}`;

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
        posA: "250,*",
        posB: "350,*",
        posC: "50%,*",
        sortOrder: "desc",
        sortOrder2: "asc",
        icon: "orange",
        readOnVisit: false,
        askOnOpening: true,
        fullDate: false,
        hoursFormat: "24h",
        articleFontSize: "100",
        uiFontSize: "100",
        disableDateGroups: false,
        badgeMode: "disabled",
        circularNavigation: true,
        sortBy: "date",
        sortBy2: "title",
        askRmPinned: "trashed",
        titleIsLink: true,
        showSpinner: true,
        concurrentDownloads: 5,
        updateFrequency: 15, // in minutes
        disableAutoUpdate: false,
        openInNewTab: true,
        showFullHeadline: false,
        selectFirstArticle: true,
        selectAllFeeds: true,
        openEnclosure: false,
        autoremove: false,
        autoremovesetting: "KEEP_UNREAD",
        autoremovetrash: 0,
        openNewTab: "background",
        userStyle: "",
        defaultStyle: DEFAULT_STYLE,
        hotkeys: DEFAULT_HOTKEYS as Hotkeys,
        version: 1,
        showAllFeeds: true,
        showPinned: true,
        showOnlyUnreadSources: false,
        displayFaviconInsteadOfPin: false,
        queries: [] as string[],
        invertColors: false,
        defaultView: "feed",
        cacheParsedArticles: false,
        defaultToUnreadOnly: false,
        displaySubscribeToLink: true,
        systemNotifications: false,
    };
}

export type Settings = ReturnType<typeof createDefaults>;
export type SettingKey = keyof Settings;

export const SETTING_KEYS = Object.keys(createDefaults()) as SettingKey[];
