import { useCallback, useEffect, useRef } from "react";
import { Toolbar } from "./Toolbar.tsx";
import { FeedList } from "./FeedList.tsx";
import { ArticleList } from "./ArticleList.tsx";
import { ContentPane } from "./ContentPane.tsx";
import { Indicator } from "./Indicator.tsx";
import { Properties } from "./Properties.tsx";
import { Marketplace } from "./Marketplace.tsx";
import { ContextMenu } from "./ContextMenu.tsx";
import { Resizer } from "./Resizer.tsx";
import { toolbarItems } from "../staticdb/toolbarItems.ts";
import { sources } from "../state/data.ts";
import { uiStore, type RegionName } from "../state/uiState.ts";
import { settings, useRecordVersion, useSettingsVersion, useStoreState } from "../state/hooks.ts";

export function App() {
    useSettingsVersion();
    useRecordVersion(sources);

    const focusRegion = useStoreState(uiStore, (state) => state.focusRegion);
    const focusTick = useStoreState(uiStore, (state) => state.focusTick);

    const feedsRef = useRef<HTMLElement>(null);
    const articlesRef = useRef<HTMLElement>(null);
    const contentRef = useRef<HTMLElement>(null);
    const refs = { feeds: feedsRef, articles: articlesRef, content: contentRef };

    const vertical = settings.get("layout") === "vertical";
    const feedListVisible = (settings.get("feedListVisible") ?? sources.size === 0) as boolean;

    useEffect(() => {
        const region = refs[focusRegion]?.current;
        // Not if focus is already on a row inside it, which would be stolen.
        if (region && !region.contains(document.activeElement)) {
            region.focus({ preventScroll: true });
        }
        // focusTick re-asserts focus even when the region did not change.
    }, [focusRegion, focusTick]);

    useEffect(() => {
        if (feedsRef.current) {
            feedsRef.current.style.flexBasis = settings.get("posA") + "px";
        }
    }, []);

    useEffect(() => {
        if (articlesRef.current) {
            const size = vertical ? settings.get("posC") : settings.get("posB");
            articlesRef.current.style.flexBasis = size + "px";
        }
    }, [vertical]);

    useEffect(() => {
        const onBlur = (event: FocusEvent) => {
            if (event.target instanceof window.Window) {
                uiStore.setState({ contextMenu: null });
            }
        };
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest(".context-menu")) {
                uiStore.setState({ contextMenu: null });
            }
        };
        window.addEventListener("blur", onBlur);
        document.addEventListener("mousedown", onMouseDown);
        return () => {
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("mousedown", onMouseDown);
        };
    }, []);

    const regionClass = useCallback(
        (name: RegionName) => "region" + (focusRegion === name ? " focused" : ""),
        [focusRegion]
    );

    return (
        <>
            <section
                ref={feedsRef}
                className={regionClass("feeds") + (feedListVisible ? "" : " feed-list-hidden")}
                id="feeds"
                tabIndex={0}
                onFocus={() => uiStore.setState({ focusRegion: "feeds" })}
            >
                <Toolbar items={toolbarItems.feeds} />
                <Properties />
                <FeedList hidden={!feedListVisible} />
                {feedListVisible ? <Indicator /> : null}
            </section>

            <section id="second-pane" className={vertical ? "vertical" : undefined}>
                <section
                    ref={articlesRef}
                    className={regionClass("articles")}
                    id="articles"
                    tabIndex={0}
                    onFocus={() => uiStore.setState({ focusRegion: "articles" })}
                >
                    <Toolbar items={toolbarItems.articles} />
                    <ArticleList />
                    {feedListVisible ? null : <Indicator />}
                </section>
                <section
                    ref={contentRef}
                    className={regionClass("content")}
                    id="content"
                    tabIndex={0}
                    onFocus={() => uiStore.setState({ focusRegion: "content" })}
                >
                    <ContentPane />
                </section>
            </section>

            <Resizer
                pane={feedsRef}
                layout="horizontal"
                hidden={!feedListVisible}
                onCommit={(size) => settings.save("posA", size)}
            />
            <Resizer
                pane={articlesRef}
                layout={vertical ? "vertical" : "horizontal"}
                onCommit={(size) => settings.save(vertical ? "posC" : "posB", size)}
            />
            <ContextMenu />
            <Marketplace />
        </>
    );
}
