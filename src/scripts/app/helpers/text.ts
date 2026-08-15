/** Text helpers shared by the article search and the feed marketplace filter. */

export function stripDiacritics(text: unknown): string {
    return String(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export function escapeRegExp(text: string): string {
    return text.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
}
