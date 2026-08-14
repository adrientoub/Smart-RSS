/**
 * Reader bootstrap: page-level concerns that sit outside the component tree.
 */
import { createRoot } from "react-dom/client";
import { App } from "./components/App.tsx";
import { handleKeyDown } from "./hotkeys.ts";
import { settingsStore } from "../shared/settings.ts";
import { applyTheme } from "../shared/theme.ts";
import { onFocusSource } from "./modules/focus.ts";
import { uiStore } from "./state/uiState.ts";
import { rebuildArticleList, startArticleList } from "./state/articleList.ts";
import { focusFeed, selectAllFeedsSpecial } from "./state/commands.ts";

const settings = settingsStore();

/** The sandbox is a separate document, so it needs the attribute of its own. */
function applyThemeEverywhere(): void {
    const theme = settings.get("theme");
    applyTheme(document, theme);
    const frame = document.querySelector<HTMLIFrameElement>('[name="sandbox"]');
    if (frame?.contentDocument) {
        applyTheme(frame.contentDocument, theme);
    }
}

export function start(): void {
    document.documentElement.style.fontSize = settings.get("uiFontSize") + "%";

    document.addEventListener("contextmenu", (event) => {
        const target = event.target as HTMLElement;
        if (!target.matches("#content header, #content header *, input")) {
            event.preventDefault();
        }
    });

    settings.on("change:theme", applyThemeEverywhere);
    applyThemeEverywhere();
    document.addEventListener("keydown", handleKeyDown);

    startArticleList();
    uiStore.setState((state) => ({
        query: { ...state.query, unreadOnly: Boolean(settings.get("defaultToUnreadOnly")) },
    }));
    rebuildArticleList();

    const root = document.getElementById("root");
    createRoot(root).render(<App />);

    // The sandbox document is not styled until it has loaded.
    setTimeout(applyThemeEverywhere, 0);

    let focused = false;
    onFocusSource((id) => {
        focused = true;
        setTimeout(() => focusFeed(id), 0);
    });
    if (!focused && settings.get("selectAllFeeds") && settings.get("showAllFeeds")) {
        setTimeout(selectAllFeedsSpecial, 0);
    }

    document.body.classList.remove("loading");
}
