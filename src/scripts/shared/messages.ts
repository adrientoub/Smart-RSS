/**
 * Typed messaging between the extension's contexts.
 *
 * Today the UI reaches into the background page directly through
 * `getBackgroundPage()`. That disappears under Manifest V3, where the background
 * is a service worker, so anything crossing the boundary has to be a message.
 * This module is the contract: adding a message means adding an entry to
 * `MessageMap`, and both ends are then checked against it.
 *
 * Only structured-cloneable data crosses the boundary. Backbone models cannot,
 * which is why source commands take ids rather than model instances.
 */

/** The persisted Backbone collections. The background is their only writer. */
export type StoreName = "sources" | "items" | "folders" | "toolbars";

export interface MessageMap {
    /** Refresh every feed, ignoring per-feed update frequency. */
    "load-all": { request: void; response: void };
    /** Subscribe to a feed url. */
    "new-rss": { request: { url: string }; response: void };
    /** Refresh specific sources or folders, by id. */
    "download-sources": { request: { ids: string[] }; response: void };
    /** Cancel any in-flight feed downloads. */
    "abort-downloads": { request: void; response: void };

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
