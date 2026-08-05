/**
 * See appEntrypoint.js: `window.bg` must exist and the settings cache must be
 * seeded before the options modules evaluate, so the import has to be deferred.
 */
import { settingsStore } from "./shared/settings.ts";

browser.runtime.getBackgroundPage(function (bg) {
    window.bg = bg;
    bg.appStarted.then(async () => {
        await settingsStore().load();
        await import("./app/options.js");
    });
});
