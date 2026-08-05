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
export type StoreName = "sources" | "items" | "folders" | "toolbars";

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

    /** Reader page should re-read the user stylesheet. */
    "user-style-changed": { request: void; response: void };
    /** Reader page should re-apply colour inversion. */
    "invert-colors-changed": { request: void; response: void };
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
        const reason = String((error as Error)?.message ?? error);
        if (
            reason.includes("Receiving end does not exist") ||
            reason.includes("Could not establish connection")
        ) {
            return;
        }
        console.error(`Failed to broadcast ${action}`, error);
    });
}
