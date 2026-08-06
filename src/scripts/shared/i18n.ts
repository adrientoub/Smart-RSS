import { settingsStore } from "./settings.ts";
import { isLanguageCode, languages, type MessageKey } from "./locales.ts";

type Substitutions = Record<string, string | number>;

const englishKeyByMessage = new Map(
    Object.entries(languages.en.messages).map(([key, entry]) => [entry.message, key as MessageKey])
);

function hash(value: string): string {
    let result = 2166136261;
    for (const character of value) {
        result ^= character.charCodeAt(0);
        result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36).toUpperCase();
}

export function staticMessageKey(value: string): MessageKey {
    const stem = value
        .normalize("NFKD")
        .replace(/[^\w]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase()
        .slice(0, 48);
    return `STATIC_${stem || "TEXT"}_${hash(value)}` as MessageKey;
}

export function translateFor(
    requested: string,
    key: MessageKey | string,
    substitutions: Substitutions = {}
): string {
    const language = isLanguageCode(requested) ? requested : "en";
    const catalog = languages[language].messages as typeof languages.en.messages;
    const entry = catalog[key as MessageKey] ?? languages.en.messages[key as MessageKey];
    if (!entry) {
        return key;
    }
    return entry.message.replace(/\{(\w+)\}/g, (placeholder, name) =>
        Object.hasOwn(substitutions, name) ? String(substitutions[name]) : placeholder
    );
}

export function translate(key: MessageKey | string, substitutions: Substitutions = {}): string {
    return translateFor(settingsStore().get("lang"), key, substitutions);
}

export function translateHtml(content: unknown): string {
    return String(content).replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_all, key) =>
        translate(key)
    );
}

function translateEnglishText(value: string): string {
    const suffix = value.endsWith(":") ? ":" : "";
    const base = value.replace(/:$/, "");
    const key = englishKeyByMessage.get(base) ?? staticMessageKey(base);
    if (!languages.en.messages[key]) {
        return value;
    }
    return `${translate(key)}${suffix}`;
}

export function localizeDocument(document: Document): void {
    document.documentElement.lang = settingsStore().get("lang");
    document.title = translateEnglishText(document.title);

    for (const element of document.querySelectorAll<HTMLElement>("[title], [placeholder]")) {
        for (const attribute of ["title", "placeholder"]) {
            const value = element.getAttribute(attribute);
            if (value) {
                element.setAttribute(attribute, translateEnglishText(value));
            }
        }
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const value = node.nodeValue ?? "";
        const text = value.replace(/\s+/g, " ").trim();
        if (!text || text === "%") {
            continue;
        }
        const translated = translateEnglishText(text);
        const leadingWhitespace = value.match(/^\s*/)?.[0] ?? "";
        const trailingWhitespace = value.match(/\s*$/)?.[0] ?? "";
        node.nodeValue = `${leadingWhitespace}${translated}${trailingWhitespace}`;
    }
}