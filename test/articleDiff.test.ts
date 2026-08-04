import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { articlesDiffer, htmlToText } from "../src/scripts/bgprocess/modules/articleDiff.ts";

describe("htmlToText", () => {
    it("strips tags and keeps the readable text", () => {
        assert.equal(htmlToText("<p>Hello <em>there</em></p>"), "Hello there");
    });

    it("keeps top-level text that is not wrapped in an element", () => {
        // The DOM implementation iterated fragment.children and silently dropped
        // bare text nodes; this does not.
        assert.equal(htmlToText("Hello <b>world</b>"), "Hello world");
    });

    it("does not run words together across block boundaries", () => {
        assert.equal(htmlToText("<p>one</p><p>two</p>"), "one two");
        assert.equal(htmlToText("a<br>b"), "a b");
        assert.equal(htmlToText("<li>x</li><li>y</li>"), "x y");
    });

    it("keeps inline elements from splitting words", () => {
        assert.equal(htmlToText("un<em>believ</em>able"), "unbelievable");
    });

    it("drops script and style content", () => {
        assert.equal(htmlToText("<p>a</p><script>var x = 1;</script><p>b</p>"), "a b");
        assert.equal(htmlToText("<style>.x{color:red}</style>visible"), "visible");
    });

    it("drops comments", () => {
        assert.equal(htmlToText("<p>a<!-- hidden -->b</p>"), "ab");
    });

    it("decodes entities", () => {
        assert.equal(htmlToText("<p>caf&eacute; &amp; bar</p>"), "café & bar");
    });

    it("normalises non-breaking spaces to ordinary ones", () => {
        assert.equal(htmlToText("a&nbsp;b"), "a b");
    });

    it("treats encoded markup as literal text rather than tags", () => {
        assert.equal(htmlToText("<p>&lt;p&gt;not a tag&lt;/p&gt;</p>"), "<p>not a tag</p>");
    });

    it("collapses whitespace", () => {
        assert.equal(htmlToText("<p>  a\n\n   b\t</p>"), "a b");
    });

    it("returns an empty string for empty or missing input", () => {
        assert.equal(htmlToText(""), "");
        assert.equal(htmlToText(undefined as unknown as string), "");
    });
});

describe("articlesDiffer", () => {
    const article = (title: string, content: string) => ({ title, content });

    it("reports no change when nothing changed", () => {
        const a = article("Title", "<p>Body</p>");
        assert.equal(articlesDiffer(a, article("Title", "<p>Body</p>")), false);
    });

    it("ignores markup-only changes", () => {
        assert.equal(
            articlesDiffer(
                article("Title", "<p>Body</p>"),
                article("Title", "<div class='x'>Body</div>")
            ),
            false
        );
    });

    it("ignores whitespace-only changes", () => {
        assert.equal(
            articlesDiffer(article("Title", "<p>Body</p>"), article("Title", "<p>  Body\n</p>")),
            false
        );
    });

    it("ignores an added tracking script", () => {
        assert.equal(
            articlesDiffer(
                article("Title", "<p>Body</p>"),
                article("Title", "<p>Body</p><script>track()</script>")
            ),
            false
        );
    });

    it("detects changed visible text", () => {
        assert.equal(
            articlesDiffer(article("Title", "<p>Body</p>"), article("Title", "<p>New body</p>")),
            true
        );
    });

    it("detects a changed title even when the body is identical", () => {
        assert.equal(
            articlesDiffer(article("Old", "<p>Body</p>"), article("New", "<p>Body</p>")),
            true
        );
    });

    it("ignores surrounding whitespace in titles", () => {
        assert.equal(
            articlesDiffer(article("  Title  ", "<p>Body</p>"), article("Title", "<p>Body</p>")),
            false
        );
    });

    it("treats stored content with no readable text as changed", () => {
        assert.equal(
            articlesDiffer(
                article("Title", "<script>x()</script>"),
                article("Title", "<p>Body</p>")
            ),
            true
        );
        assert.equal(articlesDiffer(article("Title", ""), article("Title", "<p>Body</p>")), true);
    });

    it("tolerates a missing title", () => {
        assert.equal(
            articlesDiffer(
                { title: undefined as unknown as string, content: "<p>Body</p>" },
                { title: undefined as unknown as string, content: "<p>Body</p>" }
            ),
            false
        );
    });
});
