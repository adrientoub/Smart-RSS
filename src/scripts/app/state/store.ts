/**
 * A minimal observable state container.
 *
 * The UI state has to be reachable from outside React — hotkeys, actions and
 * context menus all run as plain functions — so it lives here rather than in a
 * provider. State is immutable, which is what lets `useStore` compare selector
 * results by reference.
 */
export type Listener = () => void;

export interface Store<T extends object> {
    getState(): T;
    setState(patch: Partial<T> | ((state: T) => Partial<T>)): void;
    subscribe(listener: Listener): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
    let state = initial;
    const listeners = new Set<Listener>();

    return {
        getState: () => state,
        setState(patch) {
            const next = typeof patch === "function" ? patch(state) : patch;
            let changed = false;
            for (const key of Object.keys(next) as (keyof T)[]) {
                if (state[key] !== next[key]) {
                    changed = true;
                    break;
                }
            }
            if (!changed) {
                return;
            }
            state = { ...state, ...next };
            for (const listener of [...listeners]) {
                listener();
            }
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
