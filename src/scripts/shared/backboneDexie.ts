/**
 * Points `Backbone.sync` at Dexie. Imported for its side effect by every
 * collection that persists; anything without a `dexieTable` keeps Backbone's
 * own (unused) ajax sync.
 */
import Backbone from "backbone";
import { dexieSync, tableNameOf, type SyncMethod, type SyncModel } from "./dexieSync.ts";

type BackboneSync = (method: string, model: unknown, options?: unknown) => unknown;

const backbone = Backbone as unknown as { sync: BackboneSync };
const ajaxSync = backbone.sync;

backbone.sync = function (method, model, options) {
    const target = model as SyncModel;
    if (tableNameOf(target)) {
        return dexieSync(method as SyncMethod, target, options);
    }
    return ajaxSync.call(this, method, model, options);
};
