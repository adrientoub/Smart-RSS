import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogCategories, feedCatalog } from "../src/scripts/app/staticdb/feedCatalog.ts";
import { filterCatalog } from "../src/scripts/app/helpers/feedCatalogSearch.ts";
import { normalizeFeedUrl } from "../src/scripts/app/helpers/feedUrl.ts";

describe("feedCatalog", () => {
    it("has no duplicate feed urls", () => {
        const seen = new Set(feedCatalog.map((feed) => normalizeFeedUrl(feed.url)));
        assert.equal(seen.size, feedCatalog.length);
    });

    it("gives every entry a title, a description and a known category", () => {
        const known = new Set(catalogCategories.map((entry) => entry.id));
        for (const feed of feedCatalog) {
            assert.ok(feed.title.trim().length > 0, feed.url);
            assert.ok(feed.description.trim().length > 0, feed.url);
            assert.ok(known.has(feed.category), `${feed.url} has category ${feed.category}`);
        }
    });

    it("gives every entry absolute http(s) urls", () => {
        for (const feed of feedCatalog) {
            for (const url of [feed.url, feed.site, feed.favicon].filter(Boolean)) {
                const parsed = new URL(url as string);
                assert.match(parsed.protocol, /^https?:$/, url as string);
            }
        }
    });

    it("lists every category at least once", () => {
        for (const entry of catalogCategories) {
            const count = feedCatalog.filter((feed) => feed.category === entry.id).length;
            assert.ok(count > 0, `no feed in category ${entry.id}`);
        }
    });
});

describe("filterCatalog", () => {
    const feeds = [
        {
            url: "https://a.example/feed",
            title: "Ars Technica",
            description: "Technology news",
            site: "https://a.example",
            category: "tech" as const,
        },
        {
            url: "https://b.example/feed",
            title: "Le Monde",
            description: "Actualité française",
            site: "https://b.example",
            category: "news" as const,
        },
    ];

    it("keeps everything without a filter", () => {
        assert.deepEqual(filterCatalog(feeds), feeds);
    });

    it("matches the title case-insensitively", () => {
        const found = filterCatalog(feeds, { search: "ars" });
        assert.deepEqual(
            found.map((feed) => feed.title),
            ["Ars Technica"]
        );
    });

    it("matches the description", () => {
        const found = filterCatalog(feeds, { search: "technology news" });
        assert.equal(found.length, 1);
    });

    it("ignores diacritics", () => {
        assert.equal(filterCatalog(feeds, { search: "francaise" }).length, 1);
        assert.equal(filterCatalog(feeds, { search: "française" }).length, 1);
    });

    it("treats regex metacharacters literally", () => {
        assert.deepEqual(filterCatalog(feeds, { search: "Ars.Technica" }), []);
    });

    it("filters by category, and combines with the search", () => {
        assert.equal(filterCatalog(feeds, { category: "news" }).length, 1);
        assert.deepEqual(filterCatalog(feeds, { category: "news", search: "ars" }), []);
    });

    it("ignores surrounding whitespace", () => {
        assert.equal(filterCatalog(feeds, { search: "  ars  " }).length, 1);
    });
});

describe("normalizeFeedUrl", () => {
    it("strips the scheme, www and a trailing slash", () => {
        assert.equal(normalizeFeedUrl("https://www.example.com/feed/"), "example.com/feed");
        assert.equal(normalizeFeedUrl("http://example.com/feed"), "example.com/feed");
    });

    it("matches the uid the reader stores for a source", () => {
        const url = "https://www.theverge.com/rss/index.xml";
        const uid = url.replace(/^(.*:)?(\/\/)?(www*?\.)?/, "").replace(/\/$/, "");
        assert.equal(normalizeFeedUrl(url), uid);
    });
});
