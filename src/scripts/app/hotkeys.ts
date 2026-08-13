/**
 * Keyboard shortcuts.
 *
 * The region an element sits in decides which table applies, which is why the
 * sandbox document gets this handler too: its events never reach the reader
 * document.
 */
import shortcuts from "./staticdb/shortcuts.js";
import { executeAction } from "./actions.ts";
import { settings } from "./state/settings.ts";

export function handleKeyDown(event: KeyboardEvent): void {
    const eventDocument = (event.target as Node | null)?.ownerDocument ?? document;
    const activeElement = eventDocument.activeElement as HTMLElement | null;
    if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") {
        return;
    }

    let shortcut = "";
    if (event.ctrlKey) {
        shortcut += "ctrl+";
    }
    if (event.altKey) {
        shortcut += "alt+";
    }
    if (event.shiftKey) {
        shortcut += "shift+";
    }

    if (event.keyCode > 46 && event.keyCode < 91) {
        shortcut += String.fromCharCode(event.keyCode).toLowerCase();
    } else if (event.keyCode in shortcuts.keys) {
        shortcut += shortcuts.keys[event.keyCode];
    } else {
        return;
    }

    const hotkeys = settings.get("hotkeys") as Record<string, Record<string, string>>;
    const region = eventDocument === document ? activeElement?.closest(".region")?.id : "sandbox";
    if (region && hotkeys[region]?.[shortcut]) {
        executeAction(hotkeys[region][shortcut], event);
        event.preventDefault();
        return;
    }
    if (hotkeys.global?.[shortcut]) {
        executeAction(hotkeys.global[shortcut], event);
        event.preventDefault();
    }
}
