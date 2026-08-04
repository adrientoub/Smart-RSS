import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Node's ESM loader does not remap .js to .ts the way esbuild and tsc do, so tests
// import TypeScript sources by their real extension.
import RSSParser, {
    replaceUTCAbbr,
    type FeedSource,
    type ParsedItem,
} from "../src/scripts/bgprocess/modules/RSSParser.ts";

const fixture = (name: string) =>
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const source = (overrides: Partial<FeedSource> = {}): FeedSource => ({
    id: "src-1",
    url: "https://example.com/feed.xml",
    ...overrides,
});

const parse = (xml: string, src: FeedSource = source()) => new RSSParser(xml, src).parse();

const byTitle = (items: ParsedItem[], title: string) => {
    const found = items.find((item) => item.title === title);
    assert.ok(found, `no item titled "${title}"`);
    return found;
};

describe("RSSParser / RSS 2.0", () => {
    const { items, sourceData } = parse(fixture("rss2.xml"));

    it("finds every item", () => {
        assert.equal(items.length, 3);
    });

    it("decodes entities in the feed title", () => {
        assert.equal(sourceData.title, "Example & Friends");
    });

    it("derives uid from the feed url", () => {
        assert.equal(sourceData.uid, "example.com/feed.xml");
    });

    // Known quirk, preserved from the DOM implementation: the root element matched
    // is <rss>, and only its direct children are inspected, so <channel><link> is
    // never considered and the base falls back to the feed url's origin.
    it("falls back to the url origin for the base on RSS 2.0", () => {
        assert.equal(sourceData.base, "https://example.com");
    });

    it("decodes entities in item titles", () => {
        assert.equal(items[0].title, "First & foremost");
    });

    it("prefers content:encoded over description", () => {
        assert.equal(items[0].content, "<p>Full <em>body</em> text</p>");
    });

    it("falls back to description when there is no encoded content", () => {
        assert.equal(byTitle(items, "Relative link post").content, "Only a description here");
    });

    it("parses pubDate", () => {
        assert.equal(items[0].date, Date.parse("Tue, 04 Mar 2025 10:00:00 GMT"));
    });

    it("reads dc:creator despite the namespace prefix", () => {
        assert.equal(items[0].author, "Ada Lovelace");
    });

    it("extracts the name from an email-style author", () => {
        assert.equal(byTitle(items, "Timezone abbreviation").author, "Ada Lovelace");
    });

    it("suffixes the guid with the source id", () => {
        assert.equal(items[0].id, "post-1src-1");
        assert.equal(items[0].oldId, "post-1src-1");
    });

    it("reads enclosures", () => {
        assert.deepEqual(items[0].enclosure, [
            {
                url: "https://cdn.example.com/audio/ep1.mp3",
                name: "ep1.mp3",
                type: "audio/mpeg",
                medium: "audio",
                length: "12345",
            },
        ]);
    });

    it("reads media:content enclosures", () => {
        const item = byTitle(items, "Relative link post");
        assert.equal(item.enclosure.length, 1);
        assert.equal(item.enclosure[0].url, "https://cdn.example.com/img/cover.png");
        assert.equal(item.enclosure[0].medium, "image");
    });

    it("resolves relative links against the discovered base", () => {
        assert.equal(byTitle(items, "Relative link post").url, "https://example.com/posts/2");
    });

    it("keeps absolute links as-is", () => {
        assert.equal(items[0].url, "https://example.com/posts/1");
    });

    it("marks undated items and substitutes the current time", () => {
        const item = byTitle(items, "Relative link post");
        assert.equal(item.emptyDate, true);
        assert.ok(item.date > 0);
    });

    it("stamps every item with the source id", () => {
        assert.ok(items.every((item) => item.sourceID === "src-1"));
    });
});

describe("RSSParser / Atom", () => {
    const { items, sourceData } = parse(
        fixture("atom.xml"),
        source({ url: "https://atom.example.com/feed.xml" })
    );

    it("finds every entry", () => {
        assert.equal(items.length, 2);
    });

    it("reads the feed title", () => {
        assert.equal(sourceData.title, "Atom Example");
    });

    it("prefers the alternate link over the self link for the base", () => {
        assert.equal(sourceData.base, "https://atom.example.com/");
    });

    it("uses the alternate link href for the item url", () => {
        assert.equal(items[0].url, "https://atom.example.com/one");
    });

    it("reads author > name", () => {
        assert.equal(items[0].author, "Grace Hopper");
    });

    it("parses published dates", () => {
        assert.equal(items[0].date, Date.parse("2025-03-04T10:00:00Z"));
    });

    it("serialises xhtml content and strips the xhtml prefix", () => {
        assert.equal(
            items[0].content.replace(/\s+/g, " ").trim(),
            "<div> <p>Rich <strong>xhtml</strong> content</p> </div>"
        );
    });

    it("falls back to id for the guid", () => {
        assert.equal(items[0].id, "urn:uuid:entry-1src-1");
    });

    it("falls back to summary when there is no content", () => {
        assert.equal(items[1].content, "Second summary");
    });
});

describe("RSSParser / RDF (RSS 1.0)", () => {
    const { items, sourceData } = parse(
        fixture("rdf.xml"),
        source({ url: "https://rdf.example.org/feed" })
    );

    it("finds items that are siblings of channel", () => {
        assert.equal(items.length, 2);
        assert.equal(items[0].title, "RDF item A");
    });

    it("reads the channel title", () => {
        assert.equal(sourceData.title, "RDF Example");
    });

    it("reads dc:date", () => {
        assert.equal(items[0].date, Date.parse("2025-03-01T12:00:00Z"));
    });

    it("reads dc:creator", () => {
        assert.equal(items[0].author, "Alan Turing");
    });

    it("falls back to the feed title as author when the item has none", () => {
        const withTitle = new RSSParser(
            fixture("rdf.xml"),
            source({ url: "https://rdf.example.org/feed", title: "RDF Example" })
        ).parse();
        assert.equal(withTitle.items[1].author, "RDF Example");
    });
});

describe("RSSParser / robustness", () => {
    it("tolerates HTML entities that XML does not define", () => {
        const xml = `<?xml version="1.0"?><rss><channel><title>T</title><item><title>A&nbsp;B</title><description>x&mdash;y</description></item></channel></rss>`;
        const { items } = parse(xml);
        assert.equal(items.length, 1);
        assert.equal(items[0].title, "A\u00a0B");
        assert.equal(items[0].content, "x\u2014y");
    });

    it("throws on malformed XML", () => {
        assert.throws(() => parse("<rss><channel></rss>"));
    });

    it("throws when no source is given", () => {
        assert.throws(
            () => new RSSParser("<rss/>", undefined as unknown as FeedSource),
            /No source specified/
        );
    });

    it("returns no items for a feed with none", () => {
        const { items } = parse(
            `<?xml version="1.0"?><rss><channel><title>Empty</title></channel></rss>`
        );
        assert.deepEqual(items, []);
    });

    it("does not overwrite a title the user already set", () => {
        const { sourceData } = parse(fixture("rss2.xml"), source({ title: "My custom name" }));
        assert.equal(sourceData.title, undefined);
    });

    it("does replace a title that is still just the url", () => {
        const url = "https://example.com/feed.xml";
        const { sourceData } = parse(fixture("rss2.xml"), source({ url, title: url }));
        assert.equal(sourceData.title, "Example & Friends");
    });
});

describe("replaceUTCAbbr", () => {
    it("maps known abbreviations to offsets", () => {
        assert.equal(
            replaceUTCAbbr("Wed, 05 Mar 2025 08:30:00 CET"),
            "Wed, 05 Mar 2025 08:30:00 +0100"
        );
        assert.equal(replaceUTCAbbr("05 Mar 2025 MSK"), "05 Mar 2025 +0400");
    });

    it("drops EST, which maps to an empty offset", () => {
        assert.equal(replaceUTCAbbr("05 Mar 2025 EST"), "05 Mar 2025 ");
    });

    it("leaves unknown text alone", () => {
        assert.equal(replaceUTCAbbr("05 Mar 2025 GMT"), "05 Mar 2025 GMT");
    });
});
