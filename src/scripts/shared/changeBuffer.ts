/**
 * Holds incoming changes until the consumer is ready for them.
 *
 * The reader starts listening as soon as the page loads, so nothing that lands
 * during startup is lost, but applying a change runs view code and the views do
 * not exist until the app has started.
 */
export interface ChangeBuffer<T> {
    push(change: T): void;
    start(): void;
    readonly buffering: boolean;
}

export function createChangeBuffer<T>(apply: (change: T) => void): ChangeBuffer<T> {
    let held: T[] | null = [];

    return {
        push(change) {
            if (held) {
                held.push(change);
                return;
            }
            apply(change);
        },

        start() {
            const queued = held ?? [];
            held = null;
            queued.forEach(apply);
        },

        get buffering() {
            return held !== null;
        },
    };
}
