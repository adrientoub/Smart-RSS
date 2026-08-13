/**
 * The feed to focus once the reader is up.
 *
 * Subscribing to a feed can either open the reader or reuse an open one, so the
 * id arrives two ways: pulled on startup for a reader that did not exist yet,
 * pushed for one that did.
 */
import { sendMessage, handleMessages } from "../../shared/messages.ts";

let pending: string | null = null;
let handler: ((id: string) => void) | null = null;

function deliver(id: string | null): void {
    if (!id) {
        return;
    }
    if (handler) {
        handler(id);
        return;
    }
    pending = id;
}

export async function loadPendingFocus(): Promise<void> {
    handleMessages({ "focus-source": ({ id }) => deliver(id) });
    const { id } = await sendMessage("take-source-to-focus");
    deliver(id ?? null);
}

/** Registered by the UI once it can act on it; replays anything held. */
export function onFocusSource(listener: (id: string) => void): void {
    handler = listener;
    const held = pending;
    pending = null;
    deliver(held);
}
