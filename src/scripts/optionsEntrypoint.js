/**
 * See appEntrypoint.js: the caches must be seeded before the options modules
 * evaluate, so the import has to be deferred.
 */
import { settingsStore } from "./shared/settings.ts";
import { sendMessage } from "./shared/messages.ts";

(async () => {
    await sendMessage("background-ready");
    await settingsStore().load();

    const { loadData } = await import("./app/modules/data.js");
    await loadData({ live: false });

    await import("./app/options.js");
})();
