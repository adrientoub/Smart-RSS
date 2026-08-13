/**
 * An in-memory, id-indexed collection of plain records.
 *
 * Replaces `Backbone.Collection`. Deliberately smaller: no comparator, no
 * sorting and no per-record events. Ordering is a presentation concern, so the
 * UI sorts what it renders; a store only preserves insertion order.
 *
 * Records are immutable. `update` replaces a record with a new object, which is
 * what lets React compare by reference.
 */

export interface HasId {
    id: string;
}

export interface RecordChange<T> {
    id: string;
    attrs: Partial<T>;
    record: T;
    previous: T;
}

export interface StoreChange<T> {
    added: T[];
    changed: RecordChange<T>[];
    removed: T[];
    /** True when the whole contents were replaced. */
    reset?: boolean;
}

export type StoreListener<T> = (change: StoreChange<T>) => void;

function changedAttrs<T extends object>(record: T, attrs: Partial<T>): Partial<T> | null {
    let changed: Partial<T> | null = null;
    for (const key of Object.keys(attrs) as (keyof T)[]) {
        if (record[key] === attrs[key]) {
            continue;
        }
        changed ??= {};
        changed[key] = attrs[key];
    }
    return changed;
}

export class RecordStore<T extends HasId> {
    private readonly byId = new Map<string, T>();
    private readonly listeners = new Set<StoreListener<T>>();
    private readonly defaults: Omit<T, "id">;

    /** Bumped on every change, so `useSyncExternalStore` can snapshot it. */
    version = 0;

    constructor(defaults: Omit<T, "id">) {
        this.defaults = defaults;
    }

    get size(): number {
        return this.byId.size;
    }

    get(id: string | null | undefined): T | undefined {
        return id === null || id === undefined ? undefined : this.byId.get(String(id));
    }

    has(id: string): boolean {
        return this.byId.has(id);
    }

    all(): T[] {
        return [...this.byId.values()];
    }

    values(): IterableIterator<T> {
        return this.byId.values();
    }

    where(query: Partial<T>): T[] {
        const keys = Object.keys(query) as (keyof T)[];
        return this.all().filter((record) => keys.every((key) => record[key] === query[key]));
    }

    findWhere(query: Partial<T>): T | undefined {
        const keys = Object.keys(query) as (keyof T)[];
        for (const record of this.byId.values()) {
            if (keys.every((key) => record[key] === query[key])) {
                return record;
            }
        }
        return undefined;
    }

    filter(predicate: (record: T) => boolean): T[] {
        return this.all().filter(predicate);
    }

    /** Fills in defaults for a partial record without touching the store. */
    complete(attrs: Partial<T> & HasId): T {
        return { ...this.defaults, ...attrs } as T;
    }

    subscribe(listener: StoreListener<T>): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit(change: StoreChange<T>): void {
        if (!change.added.length && !change.changed.length && !change.removed.length) {
            return;
        }
        this.version++;
        // Copied: a listener may unsubscribe itself while being notified.
        for (const listener of [...this.listeners]) {
            listener(change);
        }
    }

    /**
     * Inserts new records and merges attributes into existing ones. Missing
     * attributes are filled from the defaults only on insert.
     */
    add(records: (Partial<T> & HasId)[]): StoreChange<T> {
        const change: StoreChange<T> = { added: [], changed: [], removed: [] };
        for (const attrs of records) {
            const id = String(attrs.id);
            const existing = this.byId.get(id);
            if (!existing) {
                const record = { ...this.defaults, ...attrs, id } as T;
                this.byId.set(id, record);
                change.added.push(record);
                continue;
            }
            const changed = changedAttrs(existing, attrs as Partial<T>);
            if (!changed) {
                continue;
            }
            const record = { ...existing, ...changed } as T;
            this.byId.set(id, record);
            change.changed.push({ id, attrs: changed, record, previous: existing });
        }
        this.emit(change);
        return change;
    }

    /** In-memory update. Nothing here persists; see `repository.ts`. */
    update(id: string, attrs: Partial<T>): T | undefined {
        const existing = this.byId.get(String(id));
        if (!existing) {
            return undefined;
        }
        const changed = changedAttrs(existing, attrs);
        if (!changed) {
            return existing;
        }
        const record = { ...existing, ...changed } as T;
        this.byId.set(record.id, record);
        this.emit({
            added: [],
            changed: [{ id: record.id, attrs: changed, record, previous: existing }],
            removed: [],
        });
        return record;
    }

    /**
     * Applies per-record attribute patches in one notification. Unknown ids are
     * ignored: a patch carries only what changed, so it cannot create a record.
     */
    patch(changes: readonly { id: string; attrs: Partial<T> }[]): void {
        const change: StoreChange<T> = { added: [], changed: [], removed: [] };
        for (const { id: rawId, attrs } of changes) {
            const id = String(rawId);
            const existing = this.byId.get(id);
            if (!existing) {
                continue;
            }
            const changed = changedAttrs(existing, attrs);
            if (!changed) {
                continue;
            }
            const record = { ...existing, ...changed } as T;
            this.byId.set(id, record);
            change.changed.push({ id, attrs: changed, record, previous: existing });
        }
        this.emit(change);
    }

    /** Applies the same attributes to many records in one notification. */
    updateMany(ids: readonly string[], attrsFor: Partial<T> | ((record: T) => Partial<T>)): T[] {
        const change: StoreChange<T> = { added: [], changed: [], removed: [] };
        const updated: T[] = [];
        for (const rawId of ids) {
            const id = String(rawId);
            const existing = this.byId.get(id);
            if (!existing) {
                continue;
            }
            const attrs = typeof attrsFor === "function" ? attrsFor(existing) : attrsFor;
            const changed = changedAttrs(existing, attrs);
            if (!changed) {
                continue;
            }
            const record = { ...existing, ...changed } as T;
            this.byId.set(id, record);
            change.changed.push({ id, attrs: changed, record, previous: existing });
            updated.push(record);
        }
        this.emit(change);
        return updated;
    }

    remove(ids: readonly string[]): T[] {
        const removed: T[] = [];
        for (const rawId of ids) {
            const id = String(rawId);
            const existing = this.byId.get(id);
            if (!existing) {
                continue;
            }
            this.byId.delete(id);
            removed.push(existing);
        }
        this.emit({ added: [], changed: [], removed });
        return removed;
    }

    /** Replaces the contents. Used by the initial load and by re-reads. */
    reset(records: (Partial<T> & HasId)[]): void {
        const removed = this.all();
        this.byId.clear();
        const added: T[] = [];
        for (const attrs of records) {
            const id = String(attrs.id);
            const record = { ...this.defaults, ...attrs, id } as T;
            this.byId.set(id, record);
            added.push(record);
        }
        this.version++;
        const change: StoreChange<T> = { added, changed: [], removed, reset: true };
        for (const listener of [...this.listeners]) {
            listener(change);
        }
    }
}
