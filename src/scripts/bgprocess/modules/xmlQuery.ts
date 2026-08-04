/**
 * Minimal query helpers over a `@rgrove/parse-xml` tree.
 *
 * The feed parser used to run CSS selectors against a `DOMParser` document.
 * Service workers have no DOM, so these reproduce just the matching behaviour
 * the parser relied on: local-name matching that ignores namespace prefixes
 * (which is how `querySelector("encoded")` found `<content:encoded>`), plus
 * document-order "first of any" semantics for comma-separated selectors.
 */
import { XmlDocument, XmlElement, XmlNode, XmlText } from "@rgrove/parse-xml";

export interface Matcher {
    /** Local name, matched case-insensitively. */
    local: string;
    /** Require the direct parent to have this local name. */
    parentLocal?: string;
    /** Require the element to be a direct child of the search root. */
    directChild?: boolean;
    attrEquals?: [name: string, value: string];
    attrNotEquals?: [name: string, value: string];
}

export function isElement(node: XmlNode): node is XmlElement {
    return node instanceof XmlElement;
}

export function localName(element: XmlElement): string {
    const colon = element.name.indexOf(":");
    return colon === -1 ? element.name : element.name.slice(colon + 1);
}

export function prefix(element: XmlElement): string {
    const colon = element.name.indexOf(":");
    return colon === -1 ? "" : element.name.slice(0, colon);
}

export function childElements(node: XmlElement | XmlDocument): XmlElement[] {
    return node.children.filter(isElement);
}

/** Depth-first, document order. */
export function* descendants(node: XmlElement | XmlDocument): Generator<XmlElement> {
    for (const child of node.children) {
        if (isElement(child)) {
            yield child;
            yield* descendants(child);
        }
    }
}

export function attr(element: XmlElement, name: string): string | null {
    const value = element.attributes[name];
    return value === undefined ? null : value;
}

function matches(element: XmlElement, matcher: Matcher, root: XmlElement | XmlDocument): boolean {
    if (localName(element).toLowerCase() !== matcher.local.toLowerCase()) {
        return false;
    }
    if (matcher.directChild && element.parent !== root) {
        return false;
    }
    if (matcher.parentLocal) {
        const parent = element.parent;
        if (!parent || !isElement(parent)) {
            return false;
        }
        if (localName(parent).toLowerCase() !== matcher.parentLocal.toLowerCase()) {
            return false;
        }
    }
    if (matcher.attrEquals && attr(element, matcher.attrEquals[0]) !== matcher.attrEquals[1]) {
        return false;
    }
    if (
        matcher.attrNotEquals &&
        attr(element, matcher.attrNotEquals[0]) === matcher.attrNotEquals[1]
    ) {
        return false;
    }
    return true;
}

/**
 * First element in document order matching any of the matchers, mirroring how
 * `querySelector("a, b")` returns the earliest match rather than trying `a` first.
 */
export function findFirst(
    root: XmlElement | XmlDocument,
    matchers: Matcher | Matcher[]
): XmlElement | null {
    const list = Array.isArray(matchers) ? matchers : [matchers];
    for (const element of descendants(root)) {
        if (list.some((matcher) => matches(element, matcher, root))) {
            return element;
        }
    }
    return null;
}

export function findAll(
    root: XmlElement | XmlDocument,
    matchers: Matcher | Matcher[]
): XmlElement[] {
    const list = Array.isArray(matchers) ? matchers : [matchers];
    const found: XmlElement[] = [];
    for (const element of descendants(root)) {
        if (list.some((matcher) => matches(element, matcher, root))) {
            found.push(element);
        }
    }
    return found;
}

/** Resolve an `xmlns:prefix` declaration by walking up the tree. */
export function namespaceUri(element: XmlElement, elementPrefix: string): string | null {
    if (!elementPrefix) {
        return null;
    }
    let current: XmlNode | null = element;
    while (current) {
        if (isElement(current)) {
            const declared = current.attributes[`xmlns:${elementPrefix}`];
            if (declared !== undefined) {
                return declared;
            }
        }
        current = current.parent;
    }
    return null;
}

/** Namespace-aware lookup, replacing `getElementsByTagNameNS`. */
export function findAllInNamespace(
    root: XmlElement | XmlDocument,
    uri: string,
    local: string
): XmlElement[] {
    const found: XmlElement[] = [];
    for (const element of descendants(root)) {
        if (localName(element).toLowerCase() !== local.toLowerCase()) {
            continue;
        }
        if (namespaceUri(element, prefix(element)) === uri) {
            found.push(element);
        }
    }
    return found;
}

const XML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
};

const escapeXml = (value: string) => value.replace(/[&<>"]/g, (char) => XML_ESCAPES[char]);

/** Serialises a node back to XML, replacing `XMLSerializer` for xhtml content. */
export function serialize(node: XmlNode): string {
    if (isElement(node)) {
        const attrs = Object.entries(node.attributes)
            .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
            .join("");
        if (node.children.length === 0) {
            return `<${node.name}${attrs}/>`;
        }
        const inner = node.children.map(serialize).join("");
        return `<${node.name}${attrs}>${inner}</${node.name}>`;
    }
    if (node instanceof XmlText) {
        return escapeXml(node.text);
    }
    return "";
}
