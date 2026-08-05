/**
 * Ambient globals from the MV2 background page.
 *
 * `bgprocess/bg.js` assigns these onto `window`, and the UI pages reach them
 * through `browser.runtime.getBackgroundPage()`. They are legacy: the MV3
 * migration replaces them with message passing, at which point this file goes
 * away. Do not add new entries.
 */

/** Legacy YUIDoc annotation still present in older comments. */
type Integer = number;

/**
 * Minimal surface shared by the Backbone models and collections reachable as
 * globals. Attributes are untyped; tightening that means typing the model layer.
 */
interface LegacyBackbone {
    get(key: any): any;
    set(...args: any[]): any;
    save(...args: any[]): any;
    on(...args: any[]): any;
    off(...args: any[]): any;
    trigger(...args: any[]): any;
    where(attrs: Record<string, any>): any[];
    findWhere(attrs: Record<string, any>): any;
    attributes: Record<string, any>;
    [key: string]: any;
}

interface BackgroundPage {
    sources: LegacyBackbone;
    items: LegacyBackbone;
    folders: LegacyBackbone;
    toolbars: LegacyBackbone;
    info: LegacyBackbone;
    loader: LegacyBackbone;

    appStarted: Promise<boolean>;
    loaded: boolean;
    sourceToFocus: string | null;

    openRSS(closeIfActive?: boolean, focusSource?: string): void;

    [key: string]: any;
}

/** The background page, assigned to `window.bg` by the UI entry points. */
declare const bg: BackgroundPage;

/** The running app instance, assigned by `app/app.js`. */
declare const app: any;

/** Id of the tab hosting the reader UI. */
declare const tabID: number;

declare const info: LegacyBackbone;
declare const items: LegacyBackbone;
declare const sources: LegacyBackbone;
declare const folders: LegacyBackbone;
declare const toolbars: LegacyBackbone;
declare const loader: LegacyBackbone;

declare const Item: any;
declare const Source: any;
declare const Folder: any;
