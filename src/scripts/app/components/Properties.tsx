import { useMemo, useState } from "react";
import { folders, sources } from "../state/data.ts";
import { uiStore, type PropertiesTarget } from "../state/uiState.ts";
import { useStoreState } from "../state/hooks.ts";
import { fixURL } from "../actions.ts";
import { decodePassword, encodePassword } from "../../shared/records.ts";
import { idsOf, updateRecords } from "../../shared/dataClient.ts";
import { translate } from "../../shared/i18n.ts";
import type { SourceRecord } from "../../shared/records.ts";

const L = (key: string) => translate(key);

const MIXED = "-2";

const UPDATE_OPTIONS: [string, string][] = [
    ["-1", "USE_GLOBAL_SETTING"],
    ["0", "NEVER"],
    ["5", "EVERY_5_MINUTES"],
    ["15", "EVERY_15_MINUTES"],
    ["30", "EVERY_30_MINUTES"],
    ["60", "EVERY_HOUR"],
    ["120", "EVERY_2_HOURS"],
    ["180", "EVERY_3_HOURS"],
    ["300", "EVERY_5_HOURS"],
    ["600", "EVERY_10_HOURS"],
    ["1440", "EVERY_24_HOURS"],
    ["10080", "EVERY_WEEK"],
];

const AUTOREMOVE_OPTIONS: [string, string][] = [
    ["-1", "USE_GLOBAL_SETTING"],
    ["0", "NEVER"],
    ["1", "OLDER_THAN_DAY"],
    ["7", "OLDER_THAN_WEEK"],
    ["30", "OLDER_THAN_MONTH"],
    ["60", "OLDER_THAN_TWO_MONTHS"],
];

function targetSources(target: PropertiesTarget): SourceRecord[] {
    if (target.kind === "source") {
        return [target.source];
    }
    if (target.kind === "folder") {
        return sources.where({ folderID: target.id });
    }
    return target.sources;
}

const same = <T,>(values: T[]) => values.every((value) => value === values[0]);

export function Properties() {
    const target = useStoreState(uiStore, (state) => state.properties);
    if (!target) {
        return <div id="properties" hidden />;
    }
    // Remounted per target: the form is initialised from the record it edits.
    const key =
        target.kind === "source"
            ? target.source.id
            : target.kind === "folder"
              ? target.id
              : target.sources.map((source) => source.id).join(",");
    return <PropertiesForm key={key} target={target} />;
}

function PropertiesForm({ target }: { target: PropertiesTarget }) {
    const isSource = target.kind === "source";
    const folder = target.kind === "folder" ? folders.get(target.id) : null;
    const list = useMemo(() => targetSources(target), [target]);

    const updateEveryDiffers = !isSource && !same(list.map((source) => source.updateEvery));
    const autoremoveDiffers = !isSource && !same(list.map((source) => source.autoremove));
    const folderDiffers = !isSource && !same(list.map((source) => source.folderID));

    const first = list[0];
    const [title, setTitle] = useState(isSource ? target.source.title : (folder?.title ?? ""));
    const [url, setUrl] = useState(isSource ? target.source.url : "");
    const [username, setUsername] = useState(isSource ? target.source.username : "");
    const [password, setPassword] = useState(
        isSource ? decodePassword(target.source.password) : ""
    );
    const [proxy, setProxy] = useState(
        isSource ? Boolean(target.source.proxyThroughFeedly) : false
    );
    const [openEnclosure, setOpenEnclosure] = useState(
        isSource ? target.source.openEnclosure : "global"
    );
    const [defaultView, setDefaultView] = useState(isSource ? target.source.defaultView : "global");
    const [updateEvery, setUpdateEvery] = useState(
        updateEveryDiffers
            ? MIXED
            : String(isSource ? target.source.updateEvery : (first?.updateEvery ?? -1))
    );
    const [autoremove, setAutoremove] = useState(
        autoremoveDiffers
            ? MIXED
            : String(isSource ? target.source.autoremove : (first?.autoremove ?? -1))
    );
    const [folderID, setFolderID] = useState(
        folderDiffers ? MIXED : isSource ? target.source.folderID : (first?.folderID ?? "0")
    );

    const close = () => uiStore.setState({ properties: null });

    const save = () => {
        if (isSource) {
            updateRecords("sources", [target.source.id], {
                title,
                url: fixURL(url),
                username,
                password: encodePassword(password),
                folderID,
                updateEvery: parseInt(updateEvery, 10),
                autoremove: parseInt(autoremove, 10),
                proxyThroughFeedly: proxy,
                openEnclosure,
                defaultView,
            });
            close();
            return;
        }

        if (folder) {
            updateRecords("folders", [folder.id], { title });
        }
        const ids = idsOf(list);
        if (parseInt(updateEvery, 10) >= -1) {
            updateRecords("sources", ids, { updateEvery: parseInt(updateEvery, 10) });
        }
        if (parseInt(autoremove, 10) >= -1) {
            updateRecords("sources", ids, { autoremove: parseInt(autoremove, 10) });
        }
        if (folderID !== MIXED) {
            updateRecords("sources", ids, { folderID });
        }
        close();
    };

    const showTitle = isSource || Boolean(folder);

    return (
        <div id="properties">
            {showTitle ? (
                <label id="property-title-label">
                    {L("NAME")}:
                    <input
                        id="prop-title"
                        type="text"
                        placeholder={L("FETCH_TITLE_TIP")}
                        title={L("FETCH_TITLE_TIP")}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                    />
                </label>
            ) : null}

            {isSource ? (
                <>
                    <label id="property-title-address">
                        {L("ADDRESS")}:
                        <input
                            id="prop-url"
                            type="url"
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                        />
                    </label>
                    <details>
                        <summary>{L("MORE")}</summary>
                        <label>
                            {L("USERNAME")}:
                            <input
                                id="prop-username"
                                type="text"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                            />
                        </label>
                        <label>
                            {L("PASSWORD")}:
                            <input
                                id="prop-password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </label>
                        <label>
                            Proxy:
                            <input
                                id="prop-proxy"
                                type="checkbox"
                                checked={proxy}
                                onChange={(event) => setProxy(event.target.checked)}
                            />
                        </label>
                        <label>
                            {L("STATIC_OPEN_MEDIA_PREVIEW_AUTOMATICALLY_16SZX1O")}:
                            <select
                                id="openEnclosure"
                                value={openEnclosure}
                                onChange={(event) => setOpenEnclosure(event.target.value)}
                            >
                                <option value="global">{L("USE_GLOBAL_SETTING")}</option>
                                <option value="yes">{L("STATIC_YES_1DUDZCG")}</option>
                                <option value="no">{L("STATIC_NO_R5WQAI")}</option>
                            </select>
                        </label>
                        <label>
                            {L("STATIC_DEFAULT_VIEW_1YHRPIR")}:
                            <select
                                id="defaultView"
                                value={defaultView}
                                onChange={(event) => setDefaultView(event.target.value)}
                            >
                                <option value="global">{L("USE_GLOBAL_SETTING")}</option>
                                <option value="feed">
                                    {L("STATIC_CONTENT_FROM_FEED_1RU9T9A")}
                                </option>
                                <option value="mozilla">{L("STATIC_PARSE_WEBSITE_4CUQJ5")}</option>
                            </select>
                        </label>
                    </details>
                </>
            ) : null}

            <label>
                {L("UPDATE")}:
                <select
                    id="prop-update-every"
                    value={updateEvery}
                    onChange={(event) => setUpdateEvery(event.target.value)}
                >
                    {updateEveryDiffers ? <option value={MIXED}>&lt;mixed&gt;</option> : null}
                    {UPDATE_OPTIONS.map(([value, key]) => (
                        <option key={value} value={value}>
                            {L(key)}
                        </option>
                    ))}
                </select>
            </label>

            <label>
                {L("PARENT")}:
                <select
                    id="prop-parent"
                    value={folderID}
                    onChange={(event) => setFolderID(event.target.value)}
                >
                    {folderDiffers ? <option value={MIXED}>&lt;mixed&gt;</option> : null}
                    <option value="0">{L("ROOT_FOLDER")}</option>
                    {folders.all().map((entry) => (
                        <option key={entry.id} value={entry.id}>
                            {entry.title}
                        </option>
                    ))}
                </select>
            </label>

            <label>
                {L("AUTOREMOVE")}:
                <select
                    id="prop-autoremove"
                    value={autoremove}
                    onChange={(event) => setAutoremove(event.target.value)}
                >
                    {autoremoveDiffers ? <option value={MIXED}>&lt;mixed&gt;</option> : null}
                    {AUTOREMOVE_OPTIONS.map(([value, key]) => (
                        <option key={value} value={value}>
                            {L(key)}
                        </option>
                    ))}
                </select>
            </label>

            <button id="prop-ok" onClick={save}>
                {L("OK")}
            </button>
            <button id="prop-cancel" onClick={close}>
                {L("CANCEL")}
            </button>
        </div>
    );
}
