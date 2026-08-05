/**
 * Settings and collections are read synchronously while the app modules
 * evaluate (Locale.js, the views), so both caches are seeded first. Static
 * imports would run too early, hence the dynamic imports.
 */
import { settingsStore } from "./shared/settings.ts";
import { sendMessage } from "./shared/messages.ts";

(async () => {
    // The background still owns writing and feed downloads.
    await sendMessage("background-ready");
    await settingsStore().load();

    const { loadData, startApplyingChanges } = await import("./app/modules/data.js");
    await loadData();

    const { loadPendingFocus } = await import("./app/modules/focus.js");
    await loadPendingFocus();

    const { default: app } = await import("./app/app.js");
    app.start();
    startApplyingChanges();
})();
