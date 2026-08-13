import { useEffect, useRef, useState } from "react";
import { Readability } from "@mozilla/readability";
import { Toolbar } from "./Toolbar.tsx";
import { toolbarItems } from "../staticdb/toolbarItems.ts";
import { items, sources } from "../state/data.ts";
import { uiStore } from "../state/uiState.ts";
import { settings, useRecordVersion, useSettingsVersion, useStoreState } from "../state/hooks.ts";
import { formatFullDate } from "../helpers/formatDate.ts";
import { getElementBoolean, getElementSetting } from "../../shared/elementSettings.ts";
import { updateRecords } from "../../shared/dataClient.ts";
import { translate } from "../../shared/i18n.ts";
import { applyTheme } from "../../shared/theme.ts";
import { handleKeyDown } from "../hotkeys.ts";
import type { ParsedEnclosure } from "../../bgprocess/modules/RSSParser.ts";
import type { ItemRecord } from "../../shared/records.ts";

function Enclosure({ data, open }: { data: ParsedEnclosure; open: boolean }) {
    const [playing, setPlaying] = useState(false);

    switch (data.medium) {
        case "image":
            return (
                <details className="enclosure" open={open}>
                    <summary>
                        <a target="_blank" tabIndex={-1} href={data.url} rel="noreferrer">
                            {data.name}
                        </a>
                    </summary>
                    <img src={data.url} alt={data.name} />
                </details>
            );
        case "video":
            return (
                <details className="enclosure" open={open}>
                    <summary>
                        <a target="_blank" tabIndex={-1} href={data.url} rel="noreferrer">
                            {data.name}
                        </a>
                    </summary>
                    <video controls>
                        <source src={data.url} type={data.type} />
                    </video>
                </details>
            );
        case "audio":
            return (
                <details className="enclosure" open={open}>
                    <summary>
                        <a target="_blank" tabIndex={-1} href={data.url} rel="noreferrer">
                            {data.name}
                        </a>
                    </summary>
                    <audio controls>
                        <source src={data.url} />
                    </audio>
                </details>
            );
        case "youtube": {
            const videoId = /^.*\/(.*)\?(.*)$/.exec(data.url)?.[1] ?? "";
            return (
                <details className="enclosure" open={open}>
                    <summary>
                        <a target="_blank" tabIndex={-1} href={data.url} rel="noreferrer">
                            {data.name}
                        </a>
                    </summary>
                    {playing ? (
                        <div id="yt-wrapper">
                            <iframe
                                id="yt-player"
                                allowFullScreen
                                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
                                title={data.name}
                            />
                        </div>
                    ) : (
                        <div
                            className="youtube-cover"
                            style={{
                                backgroundImage: `url("https://i.ytimg.com/vi/${videoId}/hqdefault.jpg")`,
                            }}
                            onClick={() => setPlaying(true)}
                        >
                            <button className="lty-playbtn" type="button" />
                        </div>
                    )}
                </details>
            );
        }
        default:
            return (
                <p className="enclosure">
                    <a target="_blank" tabIndex={-1} href={data.url} rel="noreferrer">
                        {data.name}
                    </a>
                </p>
            );
    }
}

function ArticleHeader({ item }: { item: ItemRecord }) {
    useSettingsVersion();
    const source = sources.get(String(item.sourceID));
    const openEnclosure = Boolean(getElementBoolean(source, "openEnclosure"));
    const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [];

    return (
        <header>
            <h1>
                {settings.get("titleIsLink") ? (
                    <a target="_blank" tabIndex={-1} href={item.url || "#"} rel="noreferrer">
                        {item.title}
                    </a>
                ) : (
                    item.title
                )}
            </h1>
            <div id="below-h1">
                <p className="author">{item.author}</p>
                <p className="date">{formatFullDate(item.date, settings)}</p>
                {settings.get("enablePin") ? (
                    <p
                        className={item.pinned ? "pin-button pinned" : "pin-button"}
                        title={translate("PIN")}
                        onClick={() => updateRecords("items", [item.id], { pinned: !item.pinned })}
                    />
                ) : null}
                {enclosures.map((enclosure, index) => (
                    <Enclosure
                        key={enclosure.url + index}
                        data={enclosure}
                        open={openEnclosure && enclosures.length === 1}
                    />
                ))}
            </div>
        </header>
    );
}

/** Resolves the HTML to display, which may require fetching the page. */
function useArticleHtml(item: ItemRecord | null, mode: string): string {
    const [html, setHtml] = useState("");

    useEffect(() => {
        if (!item) {
            setHtml("");
            return;
        }
        const source = sources.get(String(item.sourceID));
        const view = mode || String(getElementSetting(source, "defaultView"));
        if (view !== "mozilla") {
            setHtml(item.content);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const response = await fetch(item.url, {
                    method: "GET",
                    redirect: "follow",
                    referrerPolicy: "no-referrer",
                });
                const text = await response.text();
                const parsed = new Readability(
                    new DOMParser().parseFromString(text, "text/html")
                ).parse();
                if (!cancelled) {
                    setHtml(parsed?.content ?? item.content);
                }
            } catch (error) {
                console.warn("Could not parse the article", error);
                if (!cancelled) {
                    setHtml(item.content);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [item, mode]);

    return html;
}

/**
 * The article body lives in a sandboxed frame, so it is written imperatively.
 * Nothing in it is React-owned.
 */
function Sandbox({ item, html }: { item: ItemRecord | null; html: string }) {
    const ref = useRef<HTMLIFrameElement>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const frame = ref.current;
        if (!loaded || !frame?.contentDocument || !item) {
            return;
        }
        const doc = frame.contentDocument;
        const resize = () => {
            const height = doc.body.scrollHeight;
            frame.style.minHeight = `${height}px`;
            frame.style.height = `${height}px`;
        };

        const base = doc.querySelector("base");
        if (base) {
            try {
                base.href = new URL(item.url).origin;
            } catch {
                base.removeAttribute("href");
            }
        }

        frame.contentWindow?.scrollTo(0, 0);
        document.querySelector("#content")?.scrollTo(0, 0);
        doc.documentElement.style.fontSize = settings.get("articleFontSize") + "%";

        const contentElement = doc.querySelector("#smart-rss-content");
        if (contentElement) {
            contentElement.replaceChildren(
                document.createRange().createContextualFragment(
                    // The frame is sandboxed; the extension page is not exposed to it.
                    html.replace(new RegExp(browser.runtime.getURL(""), "g"), "/")
                )
            );
        }

        const urlLink = doc.querySelector<HTMLAnchorElement>("#smart-rss-url");
        if (urlLink) {
            urlLink.href = item.url;
        }
        const urlLabel = doc.querySelector("#full-article-url");
        if (urlLabel) {
            urlLabel.textContent = item.url;
        }

        doc.querySelectorAll<HTMLMediaElement & HTMLImageElement>(
            "img, picture, iframe, video, audio"
        ).forEach((element) => {
            if (element.src?.startsWith("https://www.youtube.com/watch?")) {
                element.src = element.src.replace(
                    "https://www.youtube.com/watch?v=",
                    "https://www.youtube-nocookie.com/embed/"
                );
                element.setAttribute("allowfullscreen", "allowfullscreen");
                element.removeAttribute("height");
                element.removeAttribute("width");
            }
            element.onload = resize;
        });

        const observer = new ResizeObserver(resize);
        observer.observe(doc.body);
        resize();
        return () => observer.disconnect();
    }, [loaded, item, html]);

    return (
        <iframe
            ref={ref}
            name="sandbox"
            src="rss_content.html"
            frameBorder={0}
            tabIndex={-1}
            scrolling="no"
            hidden={!item}
            onLoad={() => {
                const doc = ref.current?.contentDocument;
                if (!doc) {
                    return;
                }
                const label = doc.querySelector("#smart-rss-url");
                if (label) {
                    label.textContent = translate("FULL_ARTICLE");
                }
                doc.querySelector("[data-base-style]")?.setAttribute(
                    "href",
                    browser.runtime.getURL("styles/main.css")
                );
                applyTheme(doc, settings.get("theme"));
                doc.addEventListener("keydown", handleKeyDown);
                setLoaded(true);
            }}
        />
    );
}

export function ContentPane() {
    useRecordVersion(items);
    const contentId = useStoreState(uiStore, (state) => state.contentId);
    const contentMode = useStoreState(uiStore, (state) => state.contentMode);
    const item = contentId ? (items.get(contentId) ?? null) : null;
    const html = useArticleHtml(item, contentMode);

    return (
        <>
            <Toolbar items={toolbarItems.content} />
            {item ? <ArticleHeader item={item} /> : null}
            <Sandbox item={item} html={html} />
        </>
    );
}
