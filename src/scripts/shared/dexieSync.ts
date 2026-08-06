/**
 * `Backbone.sync` over Dexie.
 *
 * A collection names its table with `dexieTable`; models inherit it through
 * `model.collection`. Kept free of Backbone itself so it can be exercised
 * directly against a table.
 */
import { tableFor, type StoreRecord } from "./db.ts";
import type { Table } from "dexie";

export type SyncMethod = "read" | "create" | "update" | "patch" | "delete";

export interface SyncModel {
    id?: string | number;
    idAttribute?: string;
    dexieTable?: string;
    collection?: { dexieTable?: string };
    toJSON(): StoreRecord;
    set(key: string, value: unknown): unknown;
}

export interface SyncOptions {
    success?: (data: unknown) => void;
    error?: (error: unknown) => void;
    complete?: (data: unknown) => void;
}

export function tableNameOf(model: SyncModel): string | undefined {
    return model?.dexieTable ?? model?.collection?.dexieTable;
}

function primaryKeyOf(table: Table<StoreRecord, string>, record: StoreRecord): string {
    return record[table.schema.primKey.keyPath as string] as string;
}

/**
 * Synchronous on purpose: `collection.create(attrs, { wait: true })` reads the
 * id off the model as soon as it returns, long before the write lands.
 */
function ensureId(model: SyncModel): void {
    if (model.id !== undefined && model.id !== null) {
        return;
    }
    const id = crypto.randomUUID();
    model.id = id;
    model.set(model.idAttribute ?? "id", id);
}

export function dexieSync(
    method: SyncMethod,
    model: SyncModel,
    options: SyncOptions = {}
): Promise<unknown> {
    const name = tableNameOf(model);
    if (!name) {
        return Promise.reject(new Error("No dexieTable on the model or its collection"));
    }
    const table = tableFor(name);

    let work: Promise<unknown>;
    switch (method) {
        case "read":
            work =
                model.id === undefined || model.id === null
                    ? table.toArray()
                    : table.get(String(model.id));
            break;
        case "create": {
            ensureId(model);
            const record = model.toJSON();
            work = table.add(record).then(() => record);
            break;
        }
        case "update":
        case "patch": {
            const record = model.toJSON();
            work = table.put(record).then(() => record);
            break;
        }
        case "delete": {
            const record = model.toJSON();
            work = table.delete(primaryKeyOf(table, record)).then(() => record);
            break;
        }
        default:
            work = Promise.reject(new Error(`Unsupported sync method: ${method}`));
    }

    return Promise.resolve(work).then(
        (data) => {
            options.success?.(data);
            options.complete?.(data);
            return data;
        },
        (error) => {
            options.error?.(error);
            options.complete?.(null);
            throw error;
        }
    );
}
