/**
 * @module BgProcess
 * @submodule modules/favicon
 */
const FAVICON_TIMEOUT_MS = 1000 * 30;

export interface FaviconResult {
    favicon: string;
    faviconExpires: number;
}

/**
 * Resolves the icon URL for a feed's site.
 *
 * Reading the site's HTML for `<link rel="icon">` needed a DOM, which service workers
 * lack, and picked whichever candidate responded first anyway. /favicon.ico is served
 * by the great majority of sites.
 */
export function faviconUrlFor(base: string): string {
    return new URL(base).origin + "/favicon.ico";
}

export function getImageData(type: string | null, buffer: ArrayBuffer): string | undefined {
    if (!type || !type.includes("image") || buffer.byteLength < 10) {
        return undefined;
    }

    const array = new Uint8Array(buffer);
    let raw = "";
    // Chunked: String.fromCharCode.apply overflows the call stack on large icons.
    for (let i = 0; i < array.length; i += 0x8000) {
        raw += String.fromCharCode.apply(null, [...array.subarray(i, i + 0x8000)]);
    }

    return "data:" + type + ";base64," + btoa(raw);
}

export function expiresFrom(headers: Headers): number {
    const expiresHeader = headers.get("expires");
    if (expiresHeader) {
        return Math.round(new Date(expiresHeader).getTime() / 1000);
    }

    const cacheControlHeader = headers.get("cache-control");
    let maxAge = 60 * 60 * 24 * 7;
    if (cacheControlHeader && cacheControlHeader.includes("max-age=")) {
        const match = /max-age=([0-9]+).*/gi.exec(cacheControlHeader);
        if (match) {
            maxAge = Math.max(parseInt(match[1]), maxAge);
        }
    }
    return Math.round(new Date().getTime() / 1000) + maxAge;
}

async function toDataURI(favicon: string): Promise<FaviconResult> {
    let response: Response;
    try {
        response = await fetch(favicon, { signal: AbortSignal.timeout(FAVICON_TIMEOUT_MS) });
    } catch (error) {
        throw (error as Error).name === "TimeoutError"
            ? "timeout"
            : "[modules/favicon] error on: " + favicon;
    }

    if (response.status !== 200) {
        throw "[modules/favicon] non-200 on: " + favicon;
    }

    const buffer = await response.arrayBuffer();
    const imageDataUri = getImageData(response.headers.get("content-type"), buffer);
    if (!imageDataUri) {
        throw "[modules/favicon] Not an image on: " + favicon;
    }

    return { favicon: imageDataUri, faviconExpires: expiresFrom(response.headers) };
}

export async function getFavicon(source: { base?: string }): Promise<FaviconResult> {
    return toDataURI(faviconUrlFor(String(source.base)));
}

export default { getFavicon };
