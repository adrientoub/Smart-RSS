/**
 * Settings and records are read synchronously while the app modules evaluate,
 * so both caches are seeded first. Static imports would run too early, hence
 * the dynamic imports.
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

    const { loadData, startApplyingChanges } = await import("./app/state/data.ts");
    await loadData();

    const { loadPendingFocus } = await import("./app/modules/focus.ts");
    await loadPendingFocus();

    const { start } = await import("./app/main.tsx");
    start();
    startApplyingChanges();
})().catch((error) => {
    // Nothing renders if this rejects, so the page would just sit there loading.
    console.error("Smarter RSS failed to start", error);
});
