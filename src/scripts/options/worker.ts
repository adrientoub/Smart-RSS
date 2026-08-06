/**
 * Bulk import of a Smart RSS backup, off the options page's thread.
 *
 * Writes straight into the database rather than going through the background:
 * this replaces whole tables, and the options page reloads the extension once
 * it is done.
 */
import { db, type StoreRecord } from "../shared/db.ts";

interface ImportContent {
    folders?: StoreRecord[];
    sources?: StoreRecord[];
    items?: StoreRecord[];
}

const CHUNK = 500;

const post = (message: unknown) => (self as unknown as Worker).postMessage(message);

const progress = (messageKey: string, current: number, total: number) =>
    post({ action: "message", messageKey, substitutions: { current, total } });

async function replaceTable(name: string, records: StoreRecord[], messageKey: string) {
    const table = db.table(name);
    await table.clear();
    for (let i = 0; i < records.length; i += CHUNK) {
        progress(messageKey, i, records.length);
        await table.bulkPut(records.slice(i, i + CHUNK));
    }
}

async function startImport(content: ImportContent) {
    // Folders first, then sources: each references the one before it by id.
    if (content.folders) {
        await replaceTable("folders", content.folders, "FOLDERS_PROGRESS");
    }
    if (content.sources) {
        await replaceTable("sources", content.sources, "FEEDS_PROGRESS");
    }
    if (content.items) {
        await replaceTable("items", content.items, "ARTICLES_PROGRESS");
    }
    post({ action: "finished" });
}

self.onmessage = (event: MessageEvent) => {
    if (event.data?.action !== "file-content") {
        return;
    }
    post({ action: "message", messageKey: "WRITING" });
    // A rejection here would be silent: it never reaches the worker's error event.
    startImport(event.data.value as ImportContent).catch((error) => {
        post({ action: "failed", message: String(error?.message ?? error) });
    });
};
