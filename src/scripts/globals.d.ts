/**
 * Ambient globals the MV2 background page still assigns onto `window`.
 *
 * The UI no longer reads any of these — it owns its own collections and talks to
 * the background by message. What is left is internal to `bgprocess/`, and goes
 * away when the background becomes a service worker, which has no `window`.
 * Do not add new entries.
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

/** The running app instance, assigned by `app/app.js`. */
declare const app: any;

declare const info: LegacyBackbone;
declare const items: LegacyBackbone;
declare const sources: LegacyBackbone;
declare const folders: LegacyBackbone;
declare const toolbars: LegacyBackbone;
declare const loader: LegacyBackbone;

declare const Source: any;
declare const Folder: any;
