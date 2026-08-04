/**
 * @module BgProcess
 * @submodule modules/articleDiff
 *
 * Decides whether a refetched article actually changed. Feeds routinely rewrite
 * markup between fetches without changing what the reader sees, so comparison is
 * done on visible text rather than raw HTML.
 *
 * This used to run through `document.createRange().createContextualFragment()`,
 * which service workers cannot do. The text extraction here is deliberately
 * regex-based rather than a real HTML parse: both sides go through the same
 * normalisation, so the only thing that matters is that it is consistent, and
 * the worst outcome is a wrong "changed" verdict rather than unsafe output.
 */
import he from "he";

/** Elements whose contents are never visible to the reader. */
const NON_RENDERED = /<(script|style|template|head)\b[^>]*>[\s\S]*?<\/\1>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
/** Tags that imply a visual break, so text either side must not run together. */
const BLOCK_BOUNDARY =
    /<\/?(address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;
const ANY_TAG = /<[^>]*>/g;

/**
 * Reduces an HTML fragment to the text a reader would see, normalised so that
 * whitespace and markup differences do not register as changes.
 */
export function htmlToText(html: string): string {
    if (!html) {
        return "";
    }

    const withoutMarkup = String(html)
        .replace(COMMENT, "")
        .replace(NON_RENDERED, " ")
        .replace(BLOCK_BOUNDARY, " ")
        .replace(ANY_TAG, "");

    // Entities are decoded after tag removal so that an encoded `&lt;p&gt;` is
    // treated as literal text rather than becoming a tag. The final collapse also
    // folds non-breaking spaces into ordinary ones, which is what we want: a feed
    // swapping `&nbsp;` for a space has not changed anything the reader notices.
    return he.decode(withoutMarkup).replace(/\s+/g, " ").trim();
}

export interface ComparableArticle {
    title: string;
    content: string;
}

/**
 * True when the incoming article differs from the stored one in a way worth
 * showing the reader again.
 */
export function articlesDiffer(existing: ComparableArticle, incoming: ComparableArticle): boolean {
    if (existing.content !== incoming.content) {
        const existingText = htmlToText(existing.content);

        // Nothing readable stored to compare against, so treat it as changed.
        if (!existingText) {
            return true;
        }
        if (existingText !== htmlToText(incoming.content)) {
            return true;
        }
    }

    return (existing.title ?? "").trim() !== (incoming.title ?? "").trim();
}
