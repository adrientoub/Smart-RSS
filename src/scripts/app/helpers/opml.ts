/**
 * OPML subscription lists, flattened to a feed list.
 *
 * Uses `@rgrove/parse-xml` rather than `DOMParser` so the parsing is a pure
 * function that the tests can call directly.
 */
import { parseXml, XmlElement, type XmlDocument, type XmlNode } from "@rgrove/parse-xml";
import he from "he";

export interface OpmlFeed {
    title: string;
    url: string;
    /** Title of the enclosing outline, when the feed sits in one. */
    folder: string | null;
}

const isElement = (node: XmlNode): node is XmlElement => node instanceof XmlElement;

function localName(element: XmlElement): string {
    const colon = element.name.indexOf(":");
    return (colon === -1 ? element.name : element.name.slice(colon + 1)).toLowerCase();
}

/** OPML in the wild spells it xmlUrl, xmlurl and XMLURL. */
function attr(element: XmlElement, name: string): string | null {
    const wanted = name.toLowerCase();
    for (const [key, value] of Object.entries(element.attributes)) {
        if (key.toLowerCase() === wanted) {
            return value;
        }
    }
    return null;
}

const decode = (value: string | null) => (value === null ? "" : he.decode(value).trim());

function children(node: XmlElement | XmlDocument): XmlElement[] {
    return node.children.filter(isElement);
}

function findBody(document: XmlDocument): XmlElement | XmlDocument {
    for (const root of children(document)) {
        for (const child of children(root)) {
            if (localName(child) === "body") {
                return child;
            }
        }
    }
    return document;
}

function collect(node: XmlElement | XmlDocument, folder: string | null, into: OpmlFeed[]): void {
    for (const child of children(node)) {
        if (localName(child) !== "outline") {
            continue;
        }
        const url = decode(attr(child, "xmlUrl"));
        const title = decode(attr(child, "title")) || decode(attr(child, "text"));
        if (url) {
            into.push({ title: title || url, url, folder });
            continue;
        }
        // An outline with no feed url is a folder; nested ones flatten to the outermost.
        collect(child, folder ?? (title || null), into);
    }
}

/** Throws if the document is not well-formed XML. */
export function parseOpml(xml: string): OpmlFeed[] {
    const document = parseXml(xml);
    const feeds: OpmlFeed[] = [];
    collect(findBody(document), null, feeds);
    return feeds;
}
