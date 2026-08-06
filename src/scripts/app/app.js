/**
 * @module App
 */

import comm from "./controllers/comm.js";
import Layout from "./layouts/Layout.js";
import Actions from "./collections/Actions.js";
import FeedsLayout from "./layouts/FeedsLayout.js";
import ArticlesLayout from "./layouts/ArticlesLayout.js";
import ContentLayout from "./layouts/ContentLayout.js";
import shortcuts from "./staticdb/shortcuts.js";
import { settingsStore } from "../shared/settings.ts";
import { applyTheme } from "../shared/theme.ts";

const settings = settingsStore();

document.documentElement.style.fontSize = settings.get("uiFontSize") + "%";

document.addEventListener("contextmenu", function (event) {
    if (!event.target.matches("#content header, #content header *, input")) {
        event.preventDefault();
    }
});

/** The sandbox is a separate document, so it needs the attribute of its own. */
function changeTheme() {
    const theme = settings.get("theme");
    applyTheme(document, theme);
    applyTheme(document.querySelector('[name="sandbox"]')?.contentDocument, theme);
}

settings.on("change:theme", changeTheme);
changeTheme();

function applyStylesToSandbox() {
    const baseStylePath = browser.runtime.getURL("styles/main.css");

    const frame = document.querySelector('[name="sandbox"]');
    if (!frame) {
        return;
    }

    const baseStyleTag = frame.contentDocument.querySelector("[data-base-style]");
    if (baseStyleTag) {
        baseStyleTag.setAttribute("href", baseStylePath);
    }
}

const app = (window.app = new (Layout.extend({
    el: "body",
    fixURL: function (url) {
        return url.search(/[a-z]+:\/\//) === -1 ? "https://" + url : url;
    },
    events: {
        mousedown: "handleMouseDown",
    },
    initialize: function () {
        this.actions = new Actions();

        window.addEventListener("blur", (event) => {
            this.hideContextMenus();
            if (event.target instanceof window.Window) {
                comm.trigger("stop-blur");
            }
        });

        settings.on("change:layout", this.handleLayoutChange, this);
    },
    handleLayoutChange: function () {
        if (settings.get("layout") === "vertical") {
            this.layoutToVertical();
            this.articles.enableResizing(settings.get("layout"), settings.get("posC"));
        } else {
            this.layoutToHorizontal();
            this.articles.enableResizing(settings.get("layout"), settings.get("posB"));
        }
    },
    layoutToVertical: function () {
        document.querySelector("#second-pane").classList.add("vertical");
    },
    layoutToHorizontal: function () {
        document.querySelector("#second-pane").classList.remove("vertical");
    },

    handleMouseDown: function (event) {
        if (!event.target.matches(".context-menu, .context-menu *")) {
            this.hideContextMenus();
        }
    },
    hideContextMenus: function () {
        comm.trigger("hide-overlays", { blur: true });
    },
    start: function () {
        this.attach("feeds", new FeedsLayout());
        this.attach("articles", new ArticlesLayout());
        this.attach("content", new ContentLayout());

        this.feeds.enableResizing("horizontal", settings.get("posA"));
        this.articles.enableResizing("horizontal", settings.get("posB"));
        applyStylesToSandbox();
        changeTheme();
        this.handleLayoutChange();
        document.querySelector("body").classList.remove("loading");
    },
    handleKeyDown: (event) => {
        const activeElement = document.activeElement;
        const hotkeys = settings.get("hotkeys");

        if (
            activeElement &&
            (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")
        ) {
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

        const activeRegion = activeElement.closest(".region");
        const activeRegionName = activeRegion ? activeRegion.id : null;

        if (activeRegionName && activeRegionName in hotkeys) {
            if (shortcut in hotkeys[activeRegionName]) {
                app.actions.execute(hotkeys[activeRegionName][shortcut], event);
                event.preventDefault();
                return false;
            }
        }

        if (shortcut in hotkeys.global) {
            app.actions.execute(hotkeys.global[shortcut], event);
            event.preventDefault();
            return false;
        }
    },
}))());
if (typeof browser !== "undefined") {
    window.addEventListener("unload", () => {
        browser.runtime.reload();
    });
}

document.addEventListener("keydown", app.handleKeyDown);

export default app;
