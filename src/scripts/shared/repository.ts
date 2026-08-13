/**
 * The write path onto Dexie.
 *
 * Replaces the `Backbone.sync` adapter. Only the background constructs a
 * repository: it is the single writer, and every other context mirrors it
 * through `data-changed` broadcasts.
 *
 * Writes are fire-and-forget. The in-memory store is updated synchronously so
 * callers (and the message handlers they answer) never wait on IndexedDB, which
 * is exactly what `collection.create(attrs, { wait: true })` used to rely on.
 */
import { tableFor, type StoreRecord } from "./db.ts";
import { RecordStore, type HasId } from "./recordStore.ts";

export class Repository<T extends HasId> {
    readonly store: RecordStore<T>;
    private readonly tableName: string;

    constructor(store: RecordStore<T>, tableName: string) {
        this.store = store;
        this.tableName = tableName;
    }

    private get table() {
        return tableFor(this.tableName);
    }

    private failed(action: string) {
        return (error: unknown) => {
            console.error(`Failed to ${action} in ${this.tableName}`, error);
        };
    }

    async load(): Promise<void> {
        const records = (await this.table.toArray()) as (Partial<T> & HasId)[];
        this.store.reset(records);
    }

    /**
     * Assigns the id synchronously; the write lands later. Callers read the id
     * off the returned record straight away.
     */
    create(attrs: Partial<T>): T {
        const record = this.store.complete({
            ...attrs,
            id: (attrs.id as string) ?? crypto.randomUUID(),
        } as Partial<T> & HasId);
        this.store.add([record]);
        const stored = this.store.get(record.id) ?? record;
        this.table.add(stored as StoreRecord).catch(this.failed("create"));
        return stored;
    }

    update(ids: readonly string[], attrs: Partial<T>): T[] {
        const updated = this.store.updateMany(ids, attrs);
        this.persist(updated);
        return updated;
    }

    updateEach(ids: readonly string[], attrsFor: (record: T) => Partial<T>): T[] {
        const updated = this.store.updateMany(ids, attrsFor);
        this.persist(updated);
        return updated;
    }

    /** Inserts or merges many records and writes all of them in one transaction. */
    put(records: (Partial<T> & HasId)[]): T[] {
        const change = this.store.add(records);
        const touched = [...change.added, ...change.changed.map((entry) => entry.record)];
        this.persist(touched);
        return touched;
    }

    remove(ids: readonly string[]): T[] {
        const removed = this.store.remove(ids);
        if (removed.length) {
            this.table.bulkDelete(removed.map((record) => record.id)).catch(this.failed("delete"));
        }
        return removed;
    }

    /** Writes records that are already current in the store. */
    persist(records: readonly T[]): void {
        if (!records.length) {
            return;
        }
        this.table.bulkPut(records as unknown as StoreRecord[]).catch(this.failed("write"));
    }
}
