/**
 * The persisted record shapes.
 *
 * Records are plain, structured-cloneable data: no methods, no identity, no
 * events. Domain behaviour lives in functions here; persistence lives in
 * `repository.ts`; in-memory indexing lives in `recordStore.ts`.
 */
import type { ParsedEnclosure } from "../bgprocess/modules/RSSParser.ts";

export interface ParsedContent {
    title?: string;
    content?: string;
    textContent?: string;
    excerpt?: string;
    byline?: string;
    siteName?: string;
}

export interface ItemRecord {
    id: string;
    title: string;
    author: string;
    url: string;
    date: number;
    content: string;
    sourceID: string;
    unread: boolean;
    visited: boolean;
    deleted: boolean;
    trashed: boolean;
    pinned: boolean;
    dateCreated: number;
    enclosure: ParsedEnclosure[] | string;
    emptyDate: boolean;
    trashedOn: number;
    parsedContent: ParsedContent;
}

export interface SourceRecord {
    id: string;
    title: string;
    url: string;
    base: string;
    /** In minutes; -1 uses the global default. */
    updateEvery: number;
    lastChecked: number;
    lastUpdate: number;
    username: string;
    password: string;
    hasNew: boolean;
    isLoading: boolean;
    /** In days. */
    autoremove: number;
    autoremovesetting: string;
    proxyThroughFeedly: boolean;
    favicon: string;
    faviconExpires: number;
    errorCount: number;
    lastArticle: number;
    uid: string;
    openEnclosure: string;
    folderID: string;
    defaultView: string;
    lastStatus: number;
}

export interface FolderRecord {
    id: string;
    title: string;
    opened: boolean;
}

export const itemDefaults: Omit<ItemRecord, "id"> = {
    title: "<no title>",
    author: "<no author>",
    url: "",
    date: 0,
    content: "No content loaded.",
    sourceID: "-1",
    unread: true,
    visited: false,
    deleted: false,
    trashed: false,
    pinned: false,
    dateCreated: 0,
    enclosure: [],
    emptyDate: false,
    trashedOn: 0,
    parsedContent: {},
};

export const sourceDefaults: Omit<SourceRecord, "id"> = {
    title: "",
    url: "",
    base: "",
    updateEvery: -1,
    lastChecked: 0,
    lastUpdate: 0,
    username: "",
    password: "",
    hasNew: false,
    isLoading: false,
    autoremove: -1,
    autoremovesetting: "USE_GLOBAL",
    proxyThroughFeedly: false,
    favicon: "/images/feed.png",
    faviconExpires: 0,
    errorCount: 0,
    lastArticle: 0,
    uid: "",
    openEnclosure: "global",
    folderID: "0",
    defaultView: "global",
    lastStatus: 200,
};

export const folderDefaults: Omit<FolderRecord, "id"> = {
    title: "<no title>",
    opened: false,
};

/** Obfuscation, not encryption. Exported so the UI can build the stored value. */
export function encodePassword(str: string): string {
    if (!str) {
        return "";
    }
    let enc = "enc:";
    for (let i = 0; i < str.length; i++) {
        enc += String.fromCharCode(str.charCodeAt(i) + 13);
    }
    return enc;
}

export function decodePassword(str: string): string {
    if (!str || str.indexOf("enc:") !== 0) {
        return str;
    }
    let dec = "";
    for (let i = 4; i < str.length; i++) {
        dec += String.fromCharCode(str.charCodeAt(i) - 13);
    }
    return dec;
}

export function sourcePassword(source: Pick<SourceRecord, "password">): string {
    return decodePassword(source.password);
}

/** Attributes that move an item to the trash. */
export function trashedAttrs(): Partial<ItemRecord> {
    return { trashed: true, visited: true, trashedOn: Date.now() };
}

/**
 * Attributes that tombstone an item. The record stays so the feed loader does
 * not resurrect it, but every payload field is emptied.
 */
export function markDeletedAttrs(): Partial<ItemRecord> {
    return {
        trashed: true,
        deleted: true,
        visited: true,
        unread: false,
        enclosure: "",
        pinned: false,
        content: "",
        author: "",
        title: "",
        trashedOn: 0,
        parsedContent: {},
    };
}

/** Whether `record` matches every attribute in `query`. */
export function matches<T extends object>(record: T, query: Partial<T>): boolean {
    for (const key of Object.keys(query) as (keyof T)[]) {
        if (record[key] !== query[key]) {
            return false;
        }
    }
    return true;
}
