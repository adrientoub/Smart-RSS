import { useCallback, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { buildRows, groupTitleByRow, itemRowIndexes } from "../helpers/rowModel.ts";
import { dateGroupTitle } from "../helpers/dateGroup.ts";
import { formatListDate } from "../helpers/formatDate.ts";
import { items, sources } from "../state/data.ts";
import { showContextMenu, uiStore } from "../state/uiState.ts";
import { searchArticles } from "../state/selectors.ts";
import { listArticles } from "../state/articleList.ts";
import * as commands from "../state/commands.ts";
import { settings, useRecordVersion, useSettingsVersion, useStoreState } from "../state/hooks.ts";
import { executeAction } from "../actions.ts";
import { updateRecords } from "../../shared/dataClient.ts";
import type { ItemRecord } from "../../shared/records.ts";

/** Kept in sync with `.date-group` in main.css. */
const GROUP_HEIGHT = 21;
const ESTIMATED_ITEM_HEIGHT = 44;
const ROWS_OVERSCAN = 6;

interface ItemRowProps {
    item: ItemRecord;
    multiple: boolean;
}

function rowClasses(item: ItemRecord, selected: boolean, lastSelected: boolean): string {
    const classes = ["articles-list-item"];
    if (!item.visited) {
        classes.push("unvisited");
    }
    if (item.unread) {
        classes.push("unread");
    }
    if (item.pinned && settings.get("enablePin")) {
        classes.push("pinned");
    }
    if (settings.get("lines") === "1") {
        classes.push("one-line");
    }
    if (settings.get("showFullHeadline")) {
        classes.push("full-headline");
    }
    if (selected) {
        classes.push("selected");
    }
    if (lastSelected) {
        classes.push("last-selected");
    }
    return classes.join(" ");
}

function ArticleRow({ item, multiple }: ItemRowProps) {
    const enablePin = Boolean(settings.get("enablePin"));

    let author = item.author;
    let favicon: string | undefined;
    if (multiple) {
        // The feed can be missing briefly: articles and sources reach this
        // context as separate messages.
        const source = sources.get(String(item.sourceID));
        if (source) {
            author =
                source.title !== item.author ? source.title + " - " + item.author : item.author;
            if (settings.get("displayFaviconInsteadOfPin")) {
                favicon = source.favicon;
            }
        }
    }

    return (
        <>
            <div className="item-title">{item.title}</div>
            <div
                className="item-pin"
                onMouseDown={(event) => {
                    if (!enablePin) {
                        return;
                    }
                    event.stopPropagation();
                    event.preventDefault();
                    updateRecords("items", [item.id], { pinned: !item.pinned });
                }}
            >
                {favicon ? <img src={favicon} alt="" className="source-icon icon" /> : null}
            </div>
            <div className="item-author">{author}</div>
            <time className="item-date" dateTime={new Date(item.date).toISOString()}>
                {formatListDate(item.date, settings)}
            </time>
        </>
    );
}

export function ArticleList() {
    const itemsVersion = useRecordVersion(items);
    const sourcesVersion = useRecordVersion(sources);
    const settingsVersion = useSettingsVersion();

    const query = useStoreState(uiStore, (state) => state.query);
    const search = useStoreState(uiStore, (state) => state.search);
    const selection = useStoreState(uiStore, (state) => state.articleSelection);
    const focusArticleId = useStoreState(uiStore, (state) => state.focusArticleId);

    const scrollRef = useRef<HTMLDivElement>(null);

    const articles = useMemo(
        () => searchArticles(listArticles(), search),
        // Recomputed whenever the records, the settings or the query change.
        [query, search, itemsVersion, sourcesVersion, settingsVersion]
    );

    const grouped =
        !settings.get("disableDateGroups") &&
        settings.get("sortBy") === "date" &&
        articles.length > 0;

    const rows = useMemo(
        () => buildRows(articles, (item) => item.date, grouped ? dateGroupTitle : null),
        [articles, grouped]
    );
    const rowKeys = useMemo(
        () => rows.map((row) => (row.type === "group" ? "g:" + row.title : "i:" + row.model.id)),
        [rows]
    );
    const groupTitles = useMemo(() => (grouped ? groupTitleByRow(rows) : []), [rows, grouped]);
    const itemRows = useMemo(() => itemRowIndexes(rows), [rows]);

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: (index) =>
            rows[index]?.type === "group" ? GROUP_HEIGHT : ESTIMATED_ITEM_HEIGHT,
        getItemKey: (index) => rowKeys[index] ?? index,
        overscan: ROWS_OVERSCAN,
    });

    const virtualRows = virtualizer.getVirtualItems();

    // Selection made from outside the list (keyboard, "next unread") has to be
    // brought into view before it can take focus.
    useEffect(() => {
        if (!focusArticleId) {
            return;
        }
        const itemIndex = articles.findIndex((item) => item.id === focusArticleId);
        if (itemIndex < 0) {
            uiStore.setState({ focusArticleId: null });
            return;
        }
        virtualizer.scrollToIndex(itemRows[itemIndex], { align: "auto" });
        const frame = requestAnimationFrame(() => {
            scrollRef.current
                ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusArticleId)}"]`)
                ?.focus({ preventScroll: true });
            uiStore.setState({ focusArticleId: null });
        });
        return () => cancelAnimationFrame(frame);
    }, [focusArticleId, articles, itemRows, virtualizer]);

    const selected = new Set(selection.selected);

    const stickyTitle = useMemo(() => {
        if (!groupTitles.length || !virtualRows.length) {
            return null;
        }
        const offset = scrollRef.current?.scrollTop ?? 0;
        const topRow = virtualRows.find((row) => row.end > offset) ?? virtualRows[0];
        return groupTitles[topRow.index] ?? null;
    }, [groupTitles, virtualRows]);

    const onRowMouseDown = useCallback((item: ItemRecord, event: React.MouseEvent) => {
        // Deliberately not prevented: the row has to take focus, because the
        // hotkey table is keyed on the region the focused element is in.
        if (event.button !== 0) {
            return;
        }
        commands.selectArticle(item.id, event);
    }, []);

    return (
        <div id="article-list" ref={scrollRef} tabIndex={-1}>
            <div className="date-group-sticky" hidden={!stickyTitle}>
                <div className="date-group">{stickyTitle}</div>
            </div>
            <div
                className="articles-list-sizer"
                style={{ height: virtualizer.getTotalSize() + "px" }}
            >
                {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    if (!row) {
                        return null;
                    }
                    const style = {
                        position: "absolute" as const,
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                    };
                    if (row.type === "group") {
                        return (
                            <div
                                key={virtualRow.key}
                                className="date-group"
                                data-index={virtualRow.index}
                                ref={virtualizer.measureElement}
                                style={style}
                            >
                                {row.title}
                            </div>
                        );
                    }
                    const item = row.model;
                    return (
                        <a
                            key={virtualRow.key}
                            className={rowClasses(
                                item,
                                selected.has(item.id),
                                selection.last === item.id
                            )}
                            href={item.url}
                            data-id={item.id}
                            data-index={virtualRow.index}
                            title={settings.get("showFullHeadline") ? undefined : item.title}
                            ref={virtualizer.measureElement}
                            style={style}
                            onMouseDown={(event) => onRowMouseDown(item, event)}
                            onClick={(event) => event.preventDefault()}
                            onDoubleClick={() => executeAction("articles:oneFullArticle")}
                            onContextMenu={(event) => {
                                event.preventDefault();
                                if (!selected.has(item.id)) {
                                    commands.selectArticle(item.id, {});
                                }
                                showContextMenu("items", event.clientX, event.clientY);
                            }}
                        >
                            <ArticleRow item={item} multiple={query.multiple} />
                        </a>
                    );
                })}
            </div>
        </div>
    );
}
