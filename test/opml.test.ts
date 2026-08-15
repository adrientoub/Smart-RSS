import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseOpml } from "../src/scripts/app/helpers/opml.ts";

const wrap = (body: string) =>
    `<?xml version="1.0" encoding="utf-8"?><opml version="1.0"><head><title>t</title></head><body>${body}</body></opml>`;

describe("parseOpml", () => {
    it("reads top-level feeds", () => {
        const feeds = parseOpml(
            wrap('<outline text="xkcd" type="rss" xmlUrl="https://xkcd.com/rss.xml"/>')
        );
        assert.deepEqual(feeds, [{ title: "xkcd", url: "https://xkcd.com/rss.xml", folder: null }]);
    });

    it("attributes feeds to their enclosing folder", () => {
        const feeds = parseOpml(
            wrap(
                '<outline text="News"><outline text="A" xmlUrl="https://a.example/f"/>' +
                    '<outline text="B" xmlUrl="https://b.example/f"/></outline>'
            )
        );
        assert.deepEqual(
            feeds.map((feed) => [feed.title, feed.folder]),
            [
                ["A", "News"],
                ["B", "News"],
            ]
        );
    });

    it("flattens nested folders onto the outermost one", () => {
        const feeds = parseOpml(
            wrap(
                '<outline text="News"><outline text="Local">' +
                    '<outline text="A" xmlUrl="https://a.example/f"/></outline></outline>'
            )
        );
        assert.equal(feeds[0].folder, "News");
    });

    it("prefers title over text, and falls back to the url", () => {
        const feeds = parseOpml(
            wrap(
                '<outline text="text" title="title" xmlUrl="https://a.example/f"/>' +
                    '<outline xmlUrl="https://b.example/f"/>'
            )
        );
        assert.equal(feeds[0].title, "title");
        assert.equal(feeds[1].title, "https://b.example/f");
    });

    it("accepts any spelling of the xmlUrl attribute", () => {
        const feeds = parseOpml(
            wrap(
                '<outline text="A" xmlurl="https://a.example/f"/><outline text="B" XMLURL="https://b.example/f"/>'
            )
        );
        assert.equal(feeds.length, 2);
    });

    it("decodes entities in titles and urls", () => {
        const feeds = parseOpml(
            wrap('<outline text="Tom &amp; Jerry" xmlUrl="https://a.example/f?x=1&amp;y=2"/>')
        );
        assert.equal(feeds[0].title, "Tom & Jerry");
        assert.equal(feeds[0].url, "https://a.example/f?x=1&y=2");
    });

    it("ignores outlines that carry no feed url and no children", () => {
        assert.deepEqual(parseOpml(wrap('<outline text="Empty"/>')), []);
    });

    it("throws on a document that is not well-formed", () => {
        assert.throws(() => parseOpml("<opml><body><outline></opml>"));
    });
});
