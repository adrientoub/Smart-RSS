/**
 * The app modules read `window.bg` while they evaluate, so the background page
 * has to be attached before they are imported. Static imports would run too
 * early, hence the dynamic import.
 *
 * Settings are read synchronously during that evaluation too (Locale.js), so the
 * cache has to be seeded first. It comes from `storage.local`, not the
 * background page.
 */
import { settingsStore } from "./shared/settings.ts";

browser.runtime.getBackgroundPage(function (bg) {
    window.bg = bg;
    bg.appStarted.then(async () => {
        await settingsStore().load();
        const { loadData } = await import("./app/modules/data.js");
        await loadData();
        const { default: app } = await import("./app/app.js");
        app.start();
    });
});
