/**
 * React bindings for the stores.
 *
 * Record changes are coalesced to one notification per frame: a feed refresh
 * touches hundreds of records, and each would otherwise be a render.
 */
import { useSyncExternalStore } from "react";
import type { HasId, RecordStore } from "../../shared/recordStore.ts";
import type { Store } from "./store.ts";
import { settings } from "./settings.ts";

export { settings };

interface Binding {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => number;
}

const bindings = new WeakMap<object, Binding>();

function bindRecordStore(store: RecordStore<HasId>): Binding {
    const existing = bindings.get(store);
    if (existing) {
        return existing;
    }

    let version = 0;
    let scheduled = false;
    const listeners = new Set<() => void>();

    store.subscribe(() => {
        if (scheduled) {
            return;
        }
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            version++;
            for (const listener of [...listeners]) {
                listener();
            }
        });
    });

    const binding: Binding = {
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot: () => version,
    };
    bindings.set(store, binding);
    return binding;
}

/** A number that changes whenever the store's contents do. */
export function useRecordVersion(store: RecordStore<never> | RecordStore<HasId>): number {
    const binding = bindRecordStore(store as RecordStore<HasId>);
    return useSyncExternalStore(binding.subscribe, binding.getSnapshot);
}

/**
 * Selectors must return a stable reference for unchanged state; the state
 * objects here are immutable, so returning a field satisfies that.
 */
export function useStoreState<T extends object, S>(store: Store<T>, select: (state: T) => S): S {
    return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}

let settingsVersion = 0;
const settingsListeners = new Set<() => void>();
settings.on("change", () => {
    settingsVersion++;
    for (const listener of [...settingsListeners]) {
        listener();
    }
});

/** Re-renders on any settings change. */
export function useSettingsVersion(): number {
    return useSyncExternalStore(
        (listener) => {
            settingsListeners.add(listener);
            return () => {
                settingsListeners.delete(listener);
            };
        },
        () => settingsVersion
    );
}
