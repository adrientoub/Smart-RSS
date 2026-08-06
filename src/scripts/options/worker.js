// Opened without an explicit version on purpose: this worker only reads and writes
// existing stores, so it must attach to whatever version the app already created
// (see BB.IndexedDB.version in shared/preps/indexeddb.js) and never trigger an upgrade.
const request = indexedDB.open("backbone-indexeddb");

let db;
let content;

request.addEventListener("error", function () {
    throw "Error code: " + this.errorCode;
});

request.addEventListener("success", function () {
    db = this.result;
    if (content) {
        startImport();
    }
});

onmessage = function (e) {
    if (e.data.action === "file-content") {
        content = e.data.value;
        if (db) {
            startImport();
        }
    }
};

let writes = 0;

function handleReq(req) {
    writes++;
    req.onsuccess = req.onerror = function () {
        writes--;
        if (writes <= 0) {
            postMessage({ action: "finished" });
        }
    };
}

function startImport() {
    const transaction = db.transaction(
        ["folders-backbone", "sources-backbone", "items-backbone"],
        "readwrite"
    );
    const folders = transaction.objectStore("folders-backbone");
    const sources = transaction.objectStore("sources-backbone");
    const items = transaction.objectStore("items-backbone");

    const importedFolders = content.folders;
    const importedSources = content.sources;
    const importedItems = content.items;

    if (importedFolders) {
        folders.clear();
        for (let i = 0, j = importedFolders.length; i < j; i++) {
            handleReq(folders.add(importedFolders[i]));
            if (i % 10 === 0) {
                postMessage({
                    action: "message",
                    messageKey: "FOLDERS_PROGRESS",
                    substitutions: { current: i, total: j },
                });
            }
        }
    }

    if (importedSources) {
        sources.clear();
        for (let i = 0, j = importedSources.length; i < j; i++) {
            handleReq(sources.add(importedSources[i]));
            if (i % 10 === 0) {
                postMessage({
                    action: "message",
                    messageKey: "FEEDS_PROGRESS",
                    substitutions: { current: i, total: j },
                });
            }
        }
    }

    if (importedItems) {
        items.clear();
        for (let i = 0, j = importedItems.length; i < j; i++) {
            handleReq(items.add(importedItems[i]));
            if (i % 10 === 0) {
                postMessage({
                    action: "message",
                    messageKey: "ARTICLES_PROGRESS",
                    substitutions: { current: i, total: j },
                });
            }
        }
    }

    if (writes === 0) {
        postMessage({ action: "finished" });
    } else {
        postMessage({ action: "message", messageKey: "WRITING" });
    }
}
