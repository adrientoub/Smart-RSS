/**
 * @module BgProcess
 * @submodule modules/RSSParser
 *
 * Parses RSS, Atom and RDF feeds without touching the DOM, so it can run inside
 * a Manifest V3 service worker. Pure: it reads a feed document and returns data,
 * leaving persistence to the caller.
 */
import { parseXml, XmlDocument, XmlElement } from "@rgrove/parse-xml";
import he from "he";

import {
    attr,
    childElements,
    findAll,
    findAllInNamespace,
    findFirst,
    isElement,
    localName,
    prefix,
    serialize,
    type Matcher,
} from "./xmlQuery.ts";

const MRSS_NAMESPACE = "http://search.yahoo.com/mrss/";
const ABSOLUTE_URL = /.+:\/\//;

/** The subset of a feed source the parser needs. */
export interface FeedSource {
    id: string;
    url: string;
    base?: string;
    title?: string;
}

export interface ParsedEnclosure {
    url: string;
    name: string;
    type: string;
    medium: string;
    length: string;
}

export interface ParsedItem {
    id: string;
    oldId: string;
    title: string;
    url: string | false;
    date: number;
    author: string;
    content: string;
    sourceID: string;
    enclosure: ParsedEnclosure[];
    dateCreated: number;
    emptyDate: boolean;
}

export interface ParsedSourceData {
    title?: string;
    base?: string;
    uid: string;
}

export interface ParsedFeed {
    items: ParsedItem[];
    /** Attributes the caller should persist back onto the source. */
    sourceData: ParsedSourceData;
}

const UTC_ABBREVIATIONS: Record<string, string> = {
    CET: "+0100",
    CEST: "+0200",
    EST: "",
    WET: "+0000",
    WEZ: "+0000",
    WEST: "+0100",
    EEST: "+0300",
    BST: "+0100",
    EET: "+0200",
    IST: "+0100",
    KUYT: "+0400",
    MSD: "+0400",
    MSK: "+0400",
    SAMT: "+0400",
};

const UTC_ABBREVIATION_PATTERN = new RegExp(
    "(" + Object.keys(UTC_ABBREVIATIONS).join("|") + ")",
    "gi"
);

export function replaceUTCAbbr(value: unknown): string {
    return String(value).replace(
        UTC_ABBREVIATION_PATTERN,
        (_all, abbr: string) => UTC_ABBREVIATIONS[abbr.toUpperCase()]
    );
}

const text = (element: XmlElement | null): string => (element ? element.text : "");

export class RSSParser {
    private readonly document: XmlDocument;
    private readonly source: FeedSource;
    private base: string;
    private currentNode!: XmlElement;

    constructor(response: string, source: FeedSource) {
        if (!source) {
            throw new Error("No source specified");
        }
        // Feeds routinely contain HTML entities that XML does not define. DOMParser
        // rejected those outright; resolving them here keeps such feeds working.
        this.document = parseXml(response.trim(), {
            resolveUndefinedEntity: (entity) => {
                const decoded = he.decode(entity);
                return decoded === entity ? null : decoded;
            },
        });
        this.source = source;
        this.base = source.base ?? source.url;
    }

    getLink(): string | false {
        const base = ABSOLUTE_URL.exec(this.base) ? this.base : this.source.url;
        const node = this.currentNode;

        let linkNode = findFirst(node, { local: "link", attrEquals: ["rel", "alternate"] });
        if (!linkNode) {
            linkNode = findFirst(node, { local: "link", attrEquals: ["type", "text/html"] });
        }

        // Prefer non-atom links over atom links, see http://logbuch-netzpolitik.de/
        if (!linkNode || prefix(linkNode) === "atom") {
            linkNode = findFirst(node, { local: "link" }) ?? linkNode;
        }

        if (!linkNode) {
            const guid = findFirst(node, { local: "guid" });
            if (guid && ABSOLUTE_URL.exec(guid.text)) {
                linkNode = guid;
            }
        }
        if (!linkNode) {
            return false;
        }

        let address = (linkNode.text || attr(linkNode, "href") || "").trim();

        if (!ABSOLUTE_URL.exec(address)) {
            try {
                address = new URL(address, base).toString();
            } catch {
                return false;
            }
        }

        return address.replace(/^(javascript:\.)/, "");
    }

    getSourceTitle(): string {
        const inRoot = (local: string): Matcher[] => [
            { local, parentLocal: "channel" },
            { local, parentLocal: "feed" },
            { local, parentLocal: "rss" },
        ];

        let node = findFirst(this.document, inRoot("title"));
        if (!node || !node.text.trim()) {
            node = findFirst(this.document, inRoot("description"));
        }
        if (!node || !node.text.trim()) {
            node = findFirst(this.document, inRoot("link"));
        }

        const title = (text(node).trim() || "rss").trim();
        return title.length ? title : "<no title>";
    }

    getDate(): number {
        const node = this.currentNode;
        const groups: Matcher[][] = [
            [{ local: "pubDate" }, { local: "published" }],
            [{ local: "date" }],
            [{ local: "lastBuildDate" }, { local: "updated" }, { local: "update" }],
        ];

        for (const group of groups) {
            const found = findFirst(node, group);
            if (found) {
                return new Date(replaceUTCAbbr(found.text)).getTime() || 0;
            }
        }
        return 0;
    }

    getAuthor(): string {
        const node = this.currentNode;
        const feedTitle = this.source.title;

        let creator = text(
            findFirst(node, [{ local: "creator" }, { local: "name", parentLocal: "author" }])
        ).trim();

        if (!creator) {
            creator = text(findFirst(node, { local: "author" })).trim();
        }

        if (!creator && feedTitle && feedTitle.length > 0) {
            creator = feedTitle;
        }

        if (creator) {
            if (/^\S+@\S+\.\S+\s+\(.+\)$/.test(creator)) {
                creator = creator.replace(/^\S+@\S+\.\S+\s+\((.+)\)$/, "$1");
            }
            creator = creator.replace(/\s*\(\)\s*$/, "");
            return he.decode(creator.trim());
        }

        return "no author";
    }

    getArticleTitle(): string {
        const node = findFirst(this.currentNode, { local: "title" });
        return he.decode(node ? node.text.trim() : "<no title>");
    }

    getArticleContent(): string {
        const node = this.currentNode;

        const encoded = findFirst(node, { local: "encoded" });
        if (encoded) {
            return he.decode(encoded.text);
        }

        const description = findFirst(node, { local: "description" });
        if (description) {
            return he.decode(description.text);
        }

        const content = findFirst(node, { local: "content" });
        if (content) {
            if (attr(content, "type") !== "xhtml") {
                return he.decode(content.text);
            }
            const stitched = content.children
                .filter(isElement)
                .map((child) => serialize(child))
                .join("");
            return he.decode(stitched.replace(/xhtml:/g, ""));
        }

        const summary = findFirst(node, { local: "summary" });
        if (summary) {
            return summary.text;
        }

        return "&nbsp;";
    }

    getGuid(): string {
        const guid =
            findFirst(this.currentNode, { local: "guid" }) ??
            findFirst(this.currentNode, { local: "id" });
        return (guid ? guid.text : this.getLink() || "").trim() + this.source.id;
    }

    getOldGuid(): string {
        const guid = findFirst(this.currentNode, { local: "guid" });
        return (guid ? guid.text : this.getLink() || "").trim() + this.source.id;
    }

    getEnclosure(enclosureNode: XmlElement, title: string): ParsedEnclosure {
        const url = (attr(enclosureNode, "url") ?? "").replace(/^(javascript:\.)/, "");
        const type = attr(enclosureNode, "type") ?? "";
        const name = he.decode(
            attr(enclosureNode, "url") !== null ? url.substring(url.lastIndexOf("/") + 1) : title
        );
        let medium = attr(enclosureNode, "medium") ?? this.getMediumFromType(type, name);
        medium = url.includes("youtube.com") ? "youtube" : medium;

        return { url, name, type, medium, length: attr(enclosureNode, "length") ?? "" };
    }

    getEnclosures(): ParsedEnclosure[] {
        const node = this.currentNode;
        const mediaTitleNode = findAllInNamespace(node, MRSS_NAMESPACE, "title")[0];
        const title = mediaTitleNode ? mediaTitleNode.text : "";

        const knownUrls: string[] = [];
        const enclosures: ParsedEnclosure[] = [];

        const enclosureNode = findFirst(node, { local: "enclosure" });
        if (enclosureNode) {
            const found = this.getEnclosure(enclosureNode, title);
            enclosures.push(found);
            knownUrls.push(found.url);
        }

        findAllInNamespace(node, MRSS_NAMESPACE, "content").forEach((mediaNode) => {
            const found = this.getEnclosure(mediaNode, title);
            if (knownUrls.includes(found.url)) {
                return;
            }
            knownUrls.push(found.url);
            enclosures.push(found);
        });

        return enclosures;
    }

    getMediumFromType(type: string, name: string): string {
        const extension = name.split(".")[1] ? name.split(".")[1] : "";
        const splitType = type.split("/");
        if (splitType.length > 0) {
            if (["audio", "image", "video"].includes(splitType[0])) {
                return splitType[0];
            }
            if (splitType[0] === "text") {
                return "document";
            }
        }
        if (type.includes("application/octet-stream")) {
            return "executable";
        }
        if (type.includes("application/x-msdownload")) {
            return "executable";
        }
        if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension)) {
            return "image";
        }

        return "";
    }

    getBaseUrl(): string | undefined {
        const rootElement = findFirst(this.document, [
            { local: "rss" },
            { local: "rdf" },
            { local: "feed" },
            { local: "channel" },
        ]);
        if (!rootElement) {
            return undefined;
        }

        let baseStr =
            attr(rootElement, "xml:base") ??
            attr(rootElement, "xmlns:base") ??
            attr(rootElement, "base");

        if (!baseStr) {
            const node = childElements(rootElement).find(
                (child) =>
                    localName(child).toLowerCase() === "link" && attr(child, "rel") === "alternate"
            );
            baseStr = node ? node.text || attr(node, "href") : null;
        }
        if (!baseStr) {
            const node = childElements(rootElement).find(
                (child) =>
                    localName(child).toLowerCase() === "link" && attr(child, "rel") !== "self"
            );
            baseStr = node ? attr(node, "href") : null;
        }
        if (!baseStr) {
            baseStr = new URL(this.source.url).origin;
        }

        return ABSOLUTE_URL.exec(baseStr) ? baseStr : this.source.url;
    }

    parse(): ParsedFeed {
        const sourceData: ParsedSourceData = {
            uid: this.source.url.replace(/^(.*:)?(\/\/)?(ww+\.)?/, "").replace(/\/$/, ""),
        };

        const title = he.decode(this.getSourceTitle());
        if (title && (this.source.title === this.source.url || !this.source.title)) {
            sourceData.title = title;
        }

        const baseUrl = this.getBaseUrl();
        if (baseUrl) {
            sourceData.base = baseUrl;
            // Item links resolve against the freshly discovered base, matching the
            // old behaviour where the source was saved before items were walked.
            this.base = baseUrl;
        }

        const nodes = findAll(this.document, [{ local: "item" }, { local: "entry" }]);

        const items = nodes.map((node) => {
            this.currentNode = node;
            const item: ParsedItem = {
                id: this.getGuid(),
                oldId: this.getOldGuid(),
                title: this.getArticleTitle(),
                url: this.getLink(),
                date: this.getDate(),
                author: this.getAuthor(),
                content: this.getArticleContent(),
                sourceID: this.source.id,
                enclosure: this.getEnclosures(),
                dateCreated: Date.now(),
                emptyDate: false,
            };
            if (item.date === 0) {
                item.date = Date.now();
                item.emptyDate = true;
            }
            return item;
        });

        return { items, sourceData };
    }
}

export default RSSParser;
