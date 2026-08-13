import { useEffect, useRef } from "react";
import { Icon } from "./Icon.tsx";
import { feedRows } from "../state/selectors.ts";
import { folders, sources, countsStore } from "../state/data.ts";
import { showContextMenu, uiStore } from "../state/uiState.ts";
import * as commands from "../state/commands.ts";
import { useRecordVersion, useSettingsVersion, useStoreState } from "../state/hooks.ts";
import { trashIcon } from "../staticdb/specials.ts";
import { translate } from "../../shared/i18n.ts";
import type { FeedRow } from "../helpers/feedRows.ts";

const rowTitle = (row: FeedRow) =>
    `${row.title} (${row.count} ${translate("UNREAD")}, ${row.countAll} ${translate("TOTAL")})`;

interface RowProps {
    row: FeedRow;
    selected: boolean;
    lastSelected: boolean;
    focusKey: string | null;
}

function FeedListRow({ row, selected, lastSelected, focusKey }: RowProps) {
    const ref = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        if (focusKey === row.key) {
            ref.current?.focus({ preventScroll: false });
            uiStore.setState({ focusFeedKey: null });
        }
    }, [focusKey, row.key]);

    const classes = ["sources-list-item"];
    let icon: React.ReactNode;
    let href = "#";

    if (row.kind === "special") {
        classes.push("special", row.special.name);
        if (row.special.position === "top") {
            classes.push("topSpecial");
        }
        const { counters } = countsStore.getState().counts;
        const name =
            row.special.name === "trash" ? trashIcon(counters.trashCountTotal) : row.special.icon;
        icon = <Icon name={name} className="source-icon" />;
    } else if (row.kind === "folder") {
        classes.push("folder");
        if (row.folder.opened) {
            classes.push("opened");
        }
        icon = (
            <>
                <div
                    className="folder-arrow"
                    onClick={(event) => {
                        event.stopPropagation();
                        commands.toggleFolder(row.id);
                    }}
                />
                <Icon name={row.folder.opened ? "folder-open" : "folder"} className="source-icon" />
            </>
        );
    } else {
        classes.push("source");
        const broken = row.source.errorCount > 0 && !row.source.isLoading;
        if (broken) {
            classes.push("broken");
        }
        if (row.source.isLoading) {
            classes.push("loading");
        }
        href = row.source.base || "#";
        // Rendered by state rather than hidden with CSS, so a stale class can
        // never leave a row with no icon at all.
        if (row.source.isLoading) {
            icon = <Icon name="loader" className="source-icon loading" />;
        } else if (broken) {
            icon = <Icon name="alert-triangle" className="source-icon broken" />;
        } else {
            icon = (
                <img
                    src={row.source.favicon || "/images/feed.png"}
                    className="source-icon icon"
                    alt=""
                />
            );
        }
    }

    if (row.count > 0) {
        classes.push("has-unread");
    }
    if (selected) {
        classes.push("selected");
    }
    if (lastSelected) {
        classes.push("last-selected");
    }

    const contextMenuName =
        row.kind === "special"
            ? row.special.contextMenu
            : row.kind === "folder"
              ? "folder"
              : "source";

    return (
        <a
            ref={ref}
            className={classes.join(" ")}
            href={href}
            hidden={row.hidden}
            title={rowTitle(row)}
            data-id={row.id}
            data-key={row.key}
            data-in-folder={row.kind === "source" ? (row.folderID ?? undefined) : undefined}
            onMouseDown={(event) => {
                if (event.button === 1) {
                    return;
                }
                event.preventDefault();
                if (event.button === 2) {
                    if (!selected) {
                        commands.selectFeedRow(row.key, {});
                    }
                    return;
                }
                const picked = commands.selectFeedRow(row.key, event);
                if (picked) {
                    commands.showAndFocusArticles(event);
                }
            }}
            // The row is an anchor so it can be focused; it must not navigate.
            onClick={(event) => event.preventDefault()}
            onDoubleClick={(event) => {
                if (row.kind === "folder") {
                    event.preventDefault();
                    commands.toggleFolder(row.id);
                }
            }}
            onContextMenu={(event) => {
                event.preventDefault();
                if (contextMenuName) {
                    showContextMenu(contextMenuName, event.clientX, event.clientY);
                }
            }}
        >
            {icon}
            <div className="source-title">{row.title}</div>
            <div className="source-counter">{row.count}</div>
        </a>
    );
}

export function FeedList({ hidden }: { hidden: boolean }) {
    useRecordVersion(sources);
    useRecordVersion(folders);
    useStoreState(countsStore, (state) => state.counts);
    useSettingsVersion();

    const selection = useStoreState(uiStore, (state) => state.feedSelection);
    const focusKey = useStoreState(uiStore, (state) => state.focusFeedKey);
    const rows = feedRows();
    const selected = new Set(selection.selected);

    return (
        <div id="feed-list" hidden={hidden}>
            {rows.map((row) => (
                <FeedListRow
                    key={row.key}
                    row={row}
                    selected={selected.has(row.key)}
                    lastSelected={selection.last === row.key}
                    focusKey={focusKey}
                />
            ))}
        </div>
    );
}
