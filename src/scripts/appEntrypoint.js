/**
 * Settings and collections are read synchronously while the app modules
 * evaluate (Locale.js, the views), so both caches are seeded first. Static
 * imports would run too early, hence the dynamic imports.
 */
import "./shared/polyfill.js";
import { settingsStore } from "./shared/settings.ts";
import { waitForBackground } from "./shared/messages.ts";

(async () => {
    // The background still owns writing and feed downloads.
    await waitForBackground();
    const settings = settingsStore();
    await settings.load();
    settings.on("change:lang", () => location.reload());

    const { loadData, startApplyingChanges } = await import("./app/modules/data.js");
    await loadData();

    const { loadPendingFocus } = await import("./app/modules/focus.js");
    await loadPendingFocus();

    const { default: app } = await import("./app/app.js");
    app.start();
    startApplyingChanges();
})().catch((error) => {
    // Nothing renders if this rejects, so the page would just sit there loading.
    console.error("Smart RSS failed to start", error);
});
