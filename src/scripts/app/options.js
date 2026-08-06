import actions from "./staticdb/actions.js";
import shortcuts from "./staticdb/shortcuts.js";
import { sendMessage } from "../shared/messages.ts";
import { settingsStore } from "../shared/settings.ts";
import { applyTheme } from "../shared/theme.ts";
import { localizeDocument, translate } from "../shared/i18n.ts";
import { languages } from "../shared/locales.ts";
import { createRecord, updateRecords, destroyRecords, idsOf } from "../shared/dataClient.ts";
import { db } from "../shared/db.ts";
import { sources, items, folders, reloadData } from "./modules/data.js";

const settings = settingsStore();

const changeTheme = () => applyTheme(document, settings.get("theme"));
settings.on("change:theme", changeTheme);
changeTheme();

const entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

function escapeHtml(string) {
    return String(string)
        .replace(/[&<>"']/gm, (s) => {
            return entityMap[s];
        })
        .replace(/\s/, (f) => {
            return f === " " ? " " : "";
        });
}

function decodeHTML(str = "") {
    const map = { gt: ">", lt: "<", amp: "&", quot: '"' };
    return str.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);?/gim, function ($0, $1) {
        if ($1[0] === "#") {
            return String.fromCharCode(
                $1[1].toLowerCase() === "x"
                    ? parseInt($1.substr(2), 16)
                    : parseInt($1.substr(1), 10)
            );
        } else {
            return Object.hasOwn(map, $1) ? map[$1] : $0;
        }
    });
}

JSON.safeParse = function (str) {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
};

const documentReady = () => {
    const languageSelect = document.querySelector("#lang");
    for (const [code, language] of Object.entries(languages)) {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = language.name;
        languageSelect.appendChild(option);
    }
    localizeDocument(document);

    document.querySelector("#version").textContent = browser.runtime.getManifest().version;

    const browserInfo = document.querySelector("#browser-info");
    // Firefox-only, and Chromium has no equivalent.
    if (browser.runtime.getBrowserInfo) {
        browser.runtime.getBrowserInfo().then((info) => {
            browserInfo.textContent = `${info.vendor} ${info.name} ${info.version} ${info.buildID}`;
        });
    } else {
        browserInfo.textContent = navigator.userAgent;
    }

    [
        ...document.querySelectorAll("select[id], input[type=number], input[type=range], textarea"),
    ].forEach((item) => {
        const v = settings.get(item.id);
        if (item.querySelector('option[value="true"]')) {
            item.value = v ? "true" : "false";
        } else {
            item.value = v;
        }
        if (item.type === "number") {
            item.addEventListener("input", handleChange);
        } else {
            item.addEventListener("change", handleChange);
        }
    });

    [...document.querySelectorAll("input[type=checkbox]")].forEach((item) => {
        item.checked = settings.get(item.id);
        item.addEventListener("change", handleCheck);
    });

    document.querySelector("#export-settings").addEventListener("click", handleExportSettings);
    document.querySelector("#export-smart").addEventListener("click", handleExportSmart);
    document.querySelector("#export-opml").addEventListener("click", handleExportOPML);
    document.querySelector("#clear-settings").addEventListener("click", handleClearSettings);
    document.querySelector("#clear-data").addEventListener("click", handleClearData);
    document
        .querySelector("#clear-removed-storage")
        .addEventListener("click", handleClearDeletedStorage);
    document.querySelector("#clear-favicons").addEventListener("click", handleClearFavicons);
    document.querySelector("#import-settings").addEventListener("change", handleImportSettings);
    document.querySelector("#import-smart").addEventListener("change", handleImportSmart);
    document.querySelector("#import-opml").addEventListener("change", handleImportOPML);
    document.querySelector('[name="queries"]').value = settings.get("queries").join(",");

    document.querySelector('[name="queries"]').addEventListener("change", handleChangeQueries);

    function handleChangeQueries(event) {
        const queries = event.target.value.split(",");
        settings.save("queries", queries);
    }

    const hotkeysElement = document.querySelector("#hotkeys");
    hotkeysElement.addEventListener("keydown", (event) => {
        const target = event.target;
        if (target.tagName !== "INPUT") {
            return true;
        }
        event.preventDefault();
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
        target.value = shortcut;
        return false;
    });

    const saveHotkeys = () => {
        const hotkeysSettings = {};
        [...hotkeysElement.querySelectorAll("section")].forEach((section) => {
            const sectionSettings = {};
            const sectionName = section.id;
            [...section.querySelectorAll("label")].forEach((label) => {
                const hotkey = label.querySelector("input").value;
                const action = label.querySelector("select").value;
                if (hotkey === "") {
                    return;
                }
                if (action === "") {
                    return;
                }
                sectionSettings[hotkey] = action;
            });
            hotkeysSettings[sectionName] = sectionSettings;
        });
        settings.save("hotkeys", hotkeysSettings);
    };
    const actionsMap = {};
    Object.entries(actions).forEach((obj) => {
        Object.entries(obj[1]).forEach((action) => {
            actionsMap[obj[0] + ":" + action[0]] = obj[0] + ":" + action[1]["title"];
        });
    });

    const renderHotkeysBlock = () => {
        hotkeysElement.textContent = "";
        const resetHotkeysButton = document.createElement("button");
        resetHotkeysButton.classList.add("resetHotkeysButton");
        resetHotkeysButton.textContent = translate("RESET_HOTKEYS");
        hotkeysElement.insertAdjacentElement("beforeend", resetHotkeysButton);
        const hotkeys = settings.get("hotkeys");

        for (const region in hotkeys) {
            if (Object.hasOwn(hotkeys, region)) {
                const regionElement = document.createElement("section");
                regionElement.id = region;
                const regionHeader = document.createElement("h3");
                regionHeader.insertAdjacentText("afterbegin", region);
                regionElement.insertAdjacentElement("afterbegin", regionHeader);

                hotkeysElement.insertAdjacentElement("beforeend", regionElement);

                const regionHotkeys = hotkeys[region];
                const addHotkeyButton = document.createElement("button");
                addHotkeyButton.textContent = "+";
                addHotkeyButton.classList.add("addHotkeyButton");
                regionElement.insertAdjacentElement("beforeend", addHotkeyButton);
                for (const regionHotkey in regionHotkeys) {
                    addHotkeyToElement(regionElement, regionHotkey, regionHotkeys[regionHotkey]);
                }
            }
        }
    };

    const hotkeyChangeHandler = (event) => {
        const target = event.target;
        if (
            target.classList.contains("actionHotkey") ||
            target.classList.contains("actionSelect")
        ) {
            saveHotkeys();
        }
    };

    hotkeysElement.addEventListener("change", hotkeyChangeHandler);
    hotkeysElement.addEventListener("keyup", hotkeyChangeHandler);
    hotkeysElement.addEventListener("click", (event) => {
        const target = event.target;
        if (target.classList.contains("addHotkeyButton")) {
            addHotkeyToElement(target.parentElement);
            return true;
        }
        if (target.classList.contains("removeHotkeyButton")) {
            target.parentElement.remove();
            saveHotkeys();
            return true;
        }
        if (target.classList.contains("resetHotkeysButton")) {
            if (
                confirm(translate("RESET_HOTKEYS_CONFIRM"))
            ) {
                settings.save("hotkeys", settings.defaults.hotkeys);
                browser.runtime.reload();
            }
        }
        return true;
    });

    const addHotkeyToElement = (element, hotkeyString = "", actionString = "") => {
        const label = document.createElement("label");
        label.classList.add("web-content-select-label");

        const hotkey = document.createElement("input");
        hotkey.classList.add("actionHotkey");
        hotkey.value = hotkeyString;

        const actionSelect = document.createElement("select");
        actionSelect.classList.add("actionSelect");
        Object.entries(actionsMap).forEach((action) => {
            const actionOption = document.createElement("option");
            actionOption.value = action[0];
            actionOption.textContent = action[1] ? action[1] : action[0];
            actionSelect.insertAdjacentElement("beforeend", actionOption);
        });
        actionSelect.value = actionString;
        const removeHotkeyButton = document.createElement("button");
        removeHotkeyButton.classList.add("removeHotkeyButton");
        removeHotkeyButton.textContent = "-";

        label.insertAdjacentElement("beforeend", hotkey);
        label.insertAdjacentElement("beforeend", actionSelect);
        label.insertAdjacentElement("beforeend", removeHotkeyButton);
        element.querySelector(".addHotkeyButton").insertAdjacentElement("beforebegin", label);
    };

    renderHotkeysBlock();
};

if (document.readyState !== "loading") {
    documentReady();
} else {
    document.addEventListener("DOMContentLoaded", documentReady);
}

function handleChange(event) {
    const target = event.target;
    let v = target.value;
    if (target.value === "true") {
        v = true;
    }
    if (target.value === "false") {
        v = false;
    }
    settings.save(target.id, v);
}

function handleCheck(event) {
    const target = event.target;
    settings.save(target.id, target.checked);
}

function handleExportSmart() {
    const smartExportStatus = document.querySelector("#smart-exported");
    const data = {
        folders: folders.toJSON(),
        sources: sources.toJSON(),
        items: items.toJSON(),
    };

    smartExportStatus.setAttribute("href", "#");
    smartExportStatus.removeAttribute("download");
    smartExportStatus.textContent = translate("EXPORTING_WAIT");

    setTimeout(() => {
        const expr = new Blob([JSON.stringify(data)]);
        smartExportStatus.setAttribute("href", URL.createObjectURL(expr));
        smartExportStatus.setAttribute("download", "exported-rss.smart");
        smartExportStatus.textContent = translate("DOWNLOAD_EXPORTED_DATA");
    }, 20);
}

function handleExportSettings() {
    const settingsExportStatus = document.querySelector("#settings-exported");
    const data = {
        settings: settings.toJSON(),
    };

    settingsExportStatus.setAttribute("href", "#");
    settingsExportStatus.removeAttribute("download");
    settingsExportStatus.textContent = translate("EXPORTING_WAIT");

    setTimeout(() => {
        const expr = new Blob([JSON.stringify(data)]);
        settingsExportStatus.setAttribute("href", URL.createObjectURL(expr));
        settingsExportStatus.setAttribute("download", "settings.smart");
        settingsExportStatus.textContent = translate("DOWNLOAD_EXPORTED_DATA");
    }, 20);
}

function handleExportOPML() {
    function addFolder(doc, title, id) {
        const folder = doc.createElement("outline");
        folder.setAttribute("text", escapeHtml(title));
        folder.setAttribute("title", escapeHtml(title));
        folder.setAttribute("id", id);
        return folder;
    }

    function addSource(doc, title, url) {
        const source = doc.createElement("outline");
        source.setAttribute("text", escapeHtml(title));
        source.setAttribute("title", escapeHtml(title));
        source.setAttribute("type", "rss");
        source.setAttribute("xmlUrl", url);
        return source;
    }

    function addLine(doc, to, ctn = "\n\t") {
        const line = doc.createTextNode(ctn);
        to.appendChild(line);
    }

    const opmlExportStatus = document.querySelector("#opml-exported");

    opmlExportStatus.setAttribute("href", "#");
    opmlExportStatus.removeAttribute("download");
    opmlExportStatus.textContent = translate("EXPORTING_WAIT");

    const start =
        '<?xml version="1.0" encoding="utf-8"?>\n<opml version="1.0">\n<head>\n\t<title>Newsfeeds exported from Smart RSS</title>\n</head>\n<body>';
    const end = "\n</body>\n</opml>";

    const parser = new DOMParser();
    const doc = parser.parseFromString(start + end, "application/xml");

    setTimeout(() => {
        const body = doc.querySelector("body");

        folders.forEach((folder) => {
            addLine(doc, body);
            body.appendChild(addFolder(doc, folder.get("title"), folder.get("id")));
        });

        sources.forEach((source) => {
            if (source.get("folderID")) {
                const folder = body.querySelector('[id="' + source.get("folderID") + '"]');
                if (folder) {
                    addLine(doc, folder, "\n\t\t");
                    folder.appendChild(addSource(doc, source.get("title"), source.get("url")));
                } else {
                    addLine(doc, body);
                    body.appendChild(addSource(doc, source.get("title"), source.get("url")));
                }
            } else {
                addLine(doc, body);
                body.appendChild(addSource(doc, source.get("title"), source.get("url")));
            }
        });

        const elementsWithId = body.querySelectorAll("[id]");
        [...elementsWithId].forEach((folder) => {
            folder.removeAttribute("id");
        });

        const expr = new Blob([new XMLSerializer().serializeToString(doc)]);
        opmlExportStatus.setAttribute("href", URL.createObjectURL(expr));
        opmlExportStatus.setAttribute("download", "exported-rss.opml");
        opmlExportStatus.textContent = translate("DOWNLOAD_EXPORTED_DATA");
    }, 20);
}

function handleImportSettings(event) {
    const settingsImportStatus = document.querySelector("#settings-imported");
    const file = event.target.files[0];
    if (!file || file.size === 0) {
        settingsImportStatus.textContent = translate("WRONG_FILE");
        return;
    }
    settingsImportStatus.textContent = translate("LOADING_PARSING_FILE");

    const reader = new FileReader();
    reader.onload = function () {
        const data = JSON.safeParse(this.result);

        if (!data || !data.settings) {
            settingsImportStatus.textContent = translate("WRONG_FILE");
            return;
        }

        settingsImportStatus.textContent = translate("IMPORTING_WAIT");

        // Settings live in storage.local now, so this no longer goes through the
        // IndexedDB import worker. Every extension context is notified by
        // storage.onChanged, so nothing needs reloading afterwards.
        settings
            .setMany(data.settings)
            .then(() => {
                settingsImportStatus.textContent = translate("IMPORT_FULLY_COMPLETED");
            })
            .catch((error) => {
                settingsImportStatus.textContent = translate("IMPORT_ERROR", {
                    error: error.message,
                });
            });
    };
    reader.readAsText(file);
}

function handleImportSmart(event) {
    const smartImportStatus = document.querySelector("#smart-imported");
    const file = event.target.files[0];
    if (!file || file.size === 0) {
        smartImportStatus.textContent = translate("WRONG_FILE");
        return;
    }
    smartImportStatus.textContent = translate("LOADING_PARSING_FILE");

    const reader = new FileReader();
    reader.onload = function () {
        const data = JSON.safeParse(this.result);

        if (!data || !data.items || !data.sources) {
            smartImportStatus.textContent = translate("WRONG_FILE");
            return;
        }

        smartImportStatus.textContent = translate("IMPORTING_WAIT");

        const worker = new Worker("scripts/options/worker.js");
        worker.onmessage = function (message) {
            if (message.data.action === "finished") {
                smartImportStatus.textContent = translate("LOADING_DATA_MEMORY");
                sendMessage("reload-background-data").then(function () {
                    browser.runtime.reload();
                    reloadData();
                    smartImportStatus.textContent = translate("IMPORT_FULLY_COMPLETED");
                    sendMessage("load-all");
                });
            } else if (message.data.action === "message") {
                smartImportStatus.textContent = translate(
                    message.data.messageKey,
                    message.data.substitutions
                );
            } else if (message.data.action === "failed") {
                smartImportStatus.textContent = translate("IMPORT_ERROR", {
                    error: message.data.message,
                });
            }
        };
        worker.postMessage({ action: "file-content", value: data });

        worker.onerror = function (error) {
            alert(translate("IMPORT_ERROR", { error: error.message }));
        };
    };
    reader.readAsText(file);
}

function handleImportOPML(event) {
    const opmlImportStatus = document.querySelector("#opml-imported");
    const file = event.target.files[0];
    if (!file || file.size === 0) {
        opmlImportStatus.textContent = translate("WRONG_FILE");
        return;
    }

    opmlImportStatus.textContent = translate("IMPORTING_WAIT");

    const reader = new FileReader();
    reader.onload = async function () {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.result, "application/xml");

        if (!doc) {
            opmlImportStatus.textContent = translate("WRONG_FILE");
            return;
        }

        const feeds = doc.querySelectorAll("body > outline[text], body > outline[title]");

        // Sequential: a folder's id is needed before its feeds can reference it.
        for (const feed of [...feeds]) {
            if (!feed.hasAttribute("xmlUrl")) {
                const subFeeds = feed.querySelectorAll("outline[xmlUrl]");
                const folderTitle = decodeHTML(
                    feed.getAttribute("title") || feed.getAttribute("text")
                );

                const duplicate = folders.findWhere({
                    title: folderTitle,
                });

                const folderId = duplicate
                    ? duplicate.get("id")
                    : (await createRecord("folders", { title: folderTitle })).id;

                for (const subFeed of [...subFeeds]) {
                    if (
                        sources.findWhere({
                            url: decodeHTML(subFeed.getAttribute("xmlUrl")),
                        })
                    ) {
                        continue;
                    }
                    await createRecord("sources", {
                        title: decodeHTML(
                            subFeed.getAttribute("title") || subFeed.getAttribute("text")
                        ),
                        url: decodeHTML(subFeed.getAttribute("xmlUrl")),
                        updateEvery: -1,
                        folderID: folderId,
                    });
                }
            } else {
                if (
                    sources.findWhere({
                        url: decodeHTML(feed.getAttribute("xmlUrl")),
                    })
                ) {
                    continue;
                }
                await createRecord("sources", {
                    title: decodeHTML(feed.getAttribute("title") || feed.getAttribute("text")),
                    url: decodeHTML(feed.getAttribute("xmlUrl")),
                    updateEvery: -1,
                });
            }
        }

        opmlImportStatus.textContent = translate("IMPORT_COMPLETED");

        setTimeout(function () {
            sendMessage("load-all");
        }, 10);
    };

    reader.readAsText(file);
}

function handleClearSettings() {
    if (!confirm(translate("REMOVE_SETTINGS_CONFIRM"))) {
        return;
    }
    settings.clear().then(() => {
        browser.alarms.clearAll();
        browser.runtime.reload();
    });
}

async function handleClearData() {
    if (!confirm(translate("REMOVE_DATA_CONFIRM"))) {
        return;
    }

    // Dexie closes its other connections on `versionchange`, so this does not
    // block on the reader tab or the background.
    await db.delete();
    localStorage.clear();
    browser.alarms.clearAll();
    browser.runtime.reload();
}

async function handleClearDeletedStorage() {
    if (
        !confirm(translate("REMOVE_DELETED_CONFIRM"))
    ) {
        return;
    }

    await destroyRecords("items", idsOf(items.where({ deleted: true })));
    alert(translate("DONE_REBOOT"));
    browser.runtime.reload();
}

function handleClearFavicons() {
    if (!confirm(translate("REMOVE_FAVICONS_CONFIRM"))) {
        return;
    }

    updateRecords("sources", idsOf(sources.toArray()), {
        favicon: "/images/feed.png",
        faviconExpires: 0,
    });
    alert(translate("DONE"));
}
