/**
 * See appEntrypoint.js: the caches must be seeded before the options modules
 * evaluate, so the import has to be deferred.
 */
import "./shared/polyfill.js";
import { settingsStore } from "./shared/settings.ts";
import { waitForBackground } from "./shared/messages.ts";

(async () => {
    await waitForBackground();
    const settings = settingsStore();
    await settings.load();
    settings.on("change:lang", () => location.reload());

    const { loadData } = await import("./app/modules/data.js");
    await loadData({ live: false });

    await import("./app/options.js");
})().catch((error) => {
    console.error("Smart RSS options failed to start", error);
});
