/**
 * Normalizes a feed URL to the `uid` a source record is stored with.
 *
 * Duplicate detection compares uids, so the marketplace must derive "already
 * subscribed" with exactly this expression or the two would drift apart.
 */
export function normalizeFeedUrl(url: string): string {
    return url.replace(/^(.*:)?(\/\/)?(www*?\.)?/, "").replace(/\/$/, "");
}
