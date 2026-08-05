/**
 * The feed to focus once the reader is up.
 *
 * Subscribing to a feed can either open the reader or reuse an open one, so the
 * id arrives two ways: pulled on startup for a reader that did not exist yet,
 * pushed for one that did.
 */
import { sendMessage, handleMessages } from "../../shared/messages.ts";

let pending = null;

export async function loadPendingFocus() {
    handleMessages({
        "focus-source": ({ id }) => {
            pending = id;
        },
    });
    const { id } = await sendMessage("take-source-to-focus");
    pending = id ?? pending;
}

export function pendingFocus() {
    return pending;
}

export function takePendingFocus() {
    const id = pending;
    pending = null;
    return id;
}
