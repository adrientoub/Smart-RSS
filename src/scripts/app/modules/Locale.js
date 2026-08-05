/**
 * @module App
 * @submodule modules/Locale
 */
import { locales } from "../../nls/index.js";
import { settingsStore } from "../../shared/settings.ts";

const settings = settingsStore();

const requested = settings.get("lang") || "en";
const en = locales.en;
const lang = locales[requested] || en;

/**
 * String localization
 * @class Locale
 * @constructor
 * @extends Object
 */
const Locale = {
    lang: lang,
    en: en,
    translate: function (name) {
        return lang[name] ? lang[name] : en[name] ? en[name] + "*" : name + "!";
    },
    translateHTML: function (content) {
        return String(content).replace(/\{\{(\w+)\}\}/gm, (all, str) => {
            return this.translate(str);
        });
    },
};

const handler = {
    get(target, name) {
        return target[name] ? target[name] : target.translate(name);
    },
};

export default new Proxy(Locale, handler);
