/**
 * Typed messaging between the extension's contexts.
 *
 * This is the only channel between the UI and the background. Adding a message
 * means adding an entry to `MessageMap`, and both ends are then checked against
 * it.
 *
 * Only structured-cloneable data crosses the boundary. Backbone models cannot,
 * which is why everything here travels as ids and plain attributes.
 */

/** The persisted Backbone collections. The background is their only writer. */
export type StoreName = "sources" | "items" | "folders";

export interface MessageMap {
    /** Resolves once the background has finished starting up. */
    "background-ready": { request: void; response: true };
    /** Refresh every feed, ignoring per-feed update frequency. */
    "load-all": { request: void; response: void };
    /** Subscribe to a feed url. */
    "new-rss": { request: { url: string }; response: void };
    /** Refresh specific sources or folders, by id. */
    "download-sources": { request: { ids: string[] }; response: void };
    /** Cancel any in-flight feed downloads. */
    "abort-downloads": { request: void; response: void };
    /** Re-read the collections, after something wrote to IndexedDB directly. */
    "reload-background-data": { request: void; response: void };

    /**
     * The feed a newly opened reader should focus, consumed once. The reader may
     * not exist yet when a feed is subscribed, so it asks on startup.
     */
    "take-source-to-focus": { request: void; response: { id: string | null } };
    /** Same, for a reader that is already open. */
    "focus-source": { request: { id: string }; response: void };

    /**
     * Writes. The background owns persistence because the feed loader writes
     * sources and items continuously, so the UI asks rather than writing itself.
     * Updates take a list of ids: marking a whole feed read is one message.
     */
    "data-create": {
        request: { store: StoreName; attrs: Record<string, unknown> };
        response: { id: string };
    };
    "data-update": {
        request: { store: StoreName; ids: string[]; attrs: Record<string, unknown> };
        response: void;
    };
    "data-destroy": { request: { store: StoreName; ids: string[] }; response: void };
    /** Item.trash(): soft delete, keeps the record. */
    "items-trash": { request: { ids: string[] }; response: void };
    /** Item.markAsDeleted(): drops the content but keeps a tombstone. */
    "items-mark-deleted": { request: { ids: string[] }; response: void };

    /**
     * Broadcast after the background writes, so other contexts can update their
     * own copy of a collection. Only the changed attributes are sent: articles
     * carry their full content, and most changes are a single read flag.
     */
    "data-changed": {
        request: {
            store: StoreName;
            added?: Record<string, unknown>[];
            changed?: { id: string; attrs: Record<string, unknown> }[];
            removed?: string[];
        };
        response: void;
    };
}

export type MessageName = keyof MessageMap;
export type Request<K extends MessageName> = MessageMap[K]["request"];
export type Response<K extends MessageName> = MessageMap[K]["response"];

interface Envelope {
    action: MessageName;
    payload?: unknown;
}

export type MessageHandlers = {
    [K in MessageName]?: (request: Request<K>) => Response<K> | Promise<Response<K>>;
};

function isEnvelope(message: unknown): message is Envelope {
    return (
        typeof message === "object" &&
        message !== null &&
        typeof (message as Envelope).action === "string"
    );
}

/**
 * Builds the `runtime.onMessage` listener for a set of handlers.
 *
 * Returning `undefined` for an unknown action matters: several contexts listen
 * on the same channel, and a listener that answers everything would swallow
 * messages meant for another one.
 */
export function createMessageListener(handlers: MessageHandlers) {
    return (message: unknown): Promise<unknown> | undefined => {
        if (!isEnvelope(message)) {
            return undefined;
        }
        const handler = handlers[message.action] as
            ((request: unknown) => unknown | Promise<unknown>) | undefined;
        if (!handler) {
            return undefined;
        }
        // A synchronous throw would escape into the runtime's dispatcher instead of
        // reaching the sender, so failures are always returned as a rejected promise.
        try {
            return Promise.resolve(handler(message.payload));
        } catch (error) {
            return Promise.reject(error);
        }
    };
}

export function handleMessages(handlers: MessageHandlers): void {
    browser.runtime.onMessage.addListener(createMessageListener(handlers));
}

export function sendMessage<K extends MessageName>(
    action: K,
    ...[payload]: Request<K> extends void ? [] : [Request<K>]
): Promise<Response<K>> {
    return browser.runtime.sendMessage({ action, payload }) as Promise<Response<K>>;
}

/** Nobody was listening. The runtime rejects rather than queueing the message. */
export function isNoReceiverError(error: unknown): boolean {
    if (error instanceof NoReceiverError) {
        return true;
    }
    const reason = String((error as Error)?.message ?? error);
    return (
        reason.includes("Receiving end does not exist") ||
        reason.includes("Could not establish connection")
    );
}

/** Raised for a receiver that answered without being the one we asked for. */
export class NoReceiverError extends Error {}

export interface RetryOptions {
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}

/**
 * Retries while nothing is listening yet.
 *
 * An extension page restored at browser startup can send its first message
 * before the background page has registered its listener, and that rejects
 * immediately instead of waiting. Anything else is a real failure and is
 * rethrown.
 */
export async function retryWhileNoReceiver<T>(
    attempt: () => Promise<T>,
    { timeoutMs = 30_000, sleep = defaultSleep, now = Date.now }: RetryOptions = {}
): Promise<T> {
    const deadline = now() + timeoutMs;
    let delay = 50;
    for (;;) {
        try {
            return await attempt();
        } catch (error) {
            if (!isNoReceiverError(error) || now() >= deadline) {
                throw error;
            }
        }
        await sleep(delay);
        delay = Math.min(delay * 2, 1000);
    }
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves once the background has started, however late it starts. */
export function waitForBackground(options?: RetryOptions): Promise<true> {
    return retryWhileNoReceiver(async () => {
        const ready = await sendMessage("background-ready");
        // Another extension page listening on the same channel answers with
        // undefined, which would otherwise pass for a started background.
        if (ready !== true) {
            throw new NoReceiverError("The background has not answered yet");
        }
        return ready;
    }, options);
}

/**
 * Fire-and-forget notification.
 *
 * Having no listener is normal — the reader may simply not be open — but any
 * other failure is a real one and must not be swallowed. An oversized payload
 * fails here, and silently losing it looks like data going missing.
 */
export function broadcast<K extends MessageName>(
    action: K,
    ...[payload]: Request<K> extends void ? [] : [Request<K>]
): void {
    void browser.runtime.sendMessage({ action, payload }).catch((error) => {
        if (isNoReceiverError(error)) {
            return;
        }
        console.error(`Failed to broadcast ${action}`, error);
    });
}
