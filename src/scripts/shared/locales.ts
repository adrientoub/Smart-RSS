import cs from "../../_locales/cs/messages.json" with { type: "json" };
import de from "../../_locales/de/messages.json" with { type: "json" };
import en from "../../_locales/en/messages.json" with { type: "json" };
import es from "../../_locales/es/messages.json" with { type: "json" };
import fr from "../../_locales/fr/messages.json" with { type: "json" };
import hr from "../../_locales/hr/messages.json" with { type: "json" };
import hu from "../../_locales/hu/messages.json" with { type: "json" };
import nl from "../../_locales/nl/messages.json" with { type: "json" };
import pl from "../../_locales/pl/messages.json" with { type: "json" };
import pt from "../../_locales/pt/messages.json" with { type: "json" };
import ru from "../../_locales/ru/messages.json" with { type: "json" };
import sk from "../../_locales/sk/messages.json" with { type: "json" };
import sr from "../../_locales/sr/messages.json" with { type: "json" };
import tr from "../../_locales/tr/messages.json" with { type: "json" };

export const languages = {
    en: { name: "English", messages: en },
    cs: { name: "Čeština", messages: cs },
    sk: { name: "Slovenčina", messages: sk },
    de: { name: "Deutsch", messages: de },
    tr: { name: "Türkçe", messages: tr },
    pl: { name: "Polski", messages: pl },
    ru: { name: "Русский", messages: ru },
    hu: { name: "Magyar", messages: hu },
    nl: { name: "Nederlands", messages: nl },
    fr: { name: "Français", messages: fr },
    pt: { name: "Português", messages: pt },
    hr: { name: "Hrvatski", messages: hr },
    es: { name: "Español", messages: es },
    sr: { name: "Српски", messages: sr },
} as const;

export type LanguageCode = keyof typeof languages;
export type MessageKey = keyof typeof en;

export const availableLanguageCodes = Object.keys(languages) as LanguageCode[];

export function isLanguageCode(value: string): value is LanguageCode {
    return Object.hasOwn(languages, value);
}