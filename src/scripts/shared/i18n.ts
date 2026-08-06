import { settingsStore } from "./settings.ts";
import { isLanguageCode, languages, type MessageKey } from "./locales.ts";

type Substitutions = Record<string, string | number>;

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

export function localizeDocument(document: Document): void {
    document.documentElement.lang = settingsStore().get("lang");

    for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
        const key = element.dataset.i18n;
        if (!key) {
            continue;
        }
        const suffix = element.textContent?.trim().endsWith(":") ? ":" : "";
        element.textContent = `${translate(key)}${suffix}`;
    }

    for (const element of document.querySelectorAll<HTMLElement>("[data-i18n-title]")) {
        const key = element.dataset.i18nTitle;
        if (!key) {
            continue;
        }
        element.title = translate(key);
    }
}