/**
 * @module App
 * @submodule modules/Locale
 */
import { translate, translateHtml } from "../../shared/i18n.ts";

/**
 * String localization
 * @class Locale
 * @constructor
 * @extends Object
 */
const Locale = {
    translate,
    translateHTML: translateHtml,
};

const handler = {
    get(target, name) {
        return Reflect.has(target, name) ? target[name] : target.translate(name);
    },
};

export default new Proxy(Locale, handler);
