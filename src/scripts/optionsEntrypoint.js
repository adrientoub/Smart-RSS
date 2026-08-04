/**
 * See appEntrypoint.js: `window.bg` must exist before the options modules
 * evaluate, so the import has to be deferred.
 */
browser.runtime.getBackgroundPage(function (bg) {
    window.bg = bg;
    bg.appStarted.then(async () => {
        await import("./app/options.js");
    });
});
