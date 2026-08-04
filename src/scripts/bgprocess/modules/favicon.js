/**
 * @module BgProcess
 * @submodule modules/favicon
 */
const FAVICON_TIMEOUT_MS = 1000 * 30;

async function getFaviconAddress(source) {
    const baseUrl = new URL(source.get("base"));

    if (settings.get("faviconSource") === "duckduckgo") {
        return ["https://icons.duckduckgo.com/ip3/" + baseUrl.host + ".ico"];
    }

    if (settings.get("faviconsSource") === "google") {
        return ["https://www.google.com/s2/favicons?domain=" + baseUrl.host];
    }

    let response;
    try {
        response = await fetch(baseUrl.origin, {
            signal: AbortSignal.timeout(FAVICON_TIMEOUT_MS),
        });
    } catch (error) {
        throw error.name === "TimeoutError" ? "timeout" : "network error";
    }

    if (response.status !== 200) {
        throw "Encountered non-200 response trying to parse " + baseUrl.origin;
    }

    const baseDocumentContents = (await response.text()).replace(/<body(.*?)<\/body>/gm, "");
    const baseDocument = new DOMParser().parseFromString(baseDocumentContents, "text/html");
    const linkElements = [...baseDocument.querySelectorAll('link[rel*="icon"][href]')];

    const links = new Set();
    links.add(baseUrl.origin + "/favicon.ico");

    linkElements.forEach((linkElement) => {
        const faviconAddress = linkElement.getAttribute("href");
        if (!faviconAddress) {
            return;
        }
        if (faviconAddress.includes("svg")) {
            return;
        }
        if (faviconAddress.startsWith("http")) {
            return links.add(faviconAddress);
        }
        if (faviconAddress.startsWith("//")) {
            return links.add(baseUrl.protocol + faviconAddress);
        }
        if (faviconAddress.startsWith("data")) {
            return links.add(faviconAddress);
        }
        if (faviconAddress.startsWith("/")) {
            return links.add(baseUrl.origin + faviconAddress);
        }

        links.add(baseUrl.origin + "/" + faviconAddress);
    });

    return [...links];
}

async function getFavicon(source) {
    const faviconAddresses = await getFaviconAddress(source);
    return Promise.any(faviconAddresses.map((favicon) => toDataURI(favicon)));
}

// /**
//  * Image specific data URI converter
//  * @class toDataURI
//  * @constructor
//  * @extends Object
//  */
async function toDataURI(favicon) {
    if (favicon.startsWith("data")) {
        return favicon;
    }

    let response;
    try {
        response = await fetch(favicon, { signal: AbortSignal.timeout(FAVICON_TIMEOUT_MS) });
    } catch (error) {
        throw error.name === "TimeoutError"
            ? "timeout"
            : "[modules/toDataURI] error on: " + favicon;
    }

    if (response.status !== 200) {
        throw "[modules/toDataURI] non-200 on: " + favicon;
    }

    const buffer = await response.arrayBuffer();
    const imageDataUri = getImageData(response.headers.get("content-type"), buffer);
    if (!imageDataUri) {
        throw "[modules/toDataURI] Not an image on: " + favicon;
    }

    const expiresHeader = response.headers.get("expires");

    let expires;
    if (expiresHeader) {
        expires = Math.round(new Date(expiresHeader).getTime() / 1000);
    } else {
        const cacheControlHeader = response.headers.get("cache-control");
        let maxAge = 60 * 60 * 24 * 7;
        if (cacheControlHeader && cacheControlHeader.includes("max-age=")) {
            const newMaxAge = parseInt(/max-age=([0-9]+).*/gi.exec(cacheControlHeader)[1]);
            maxAge = Math.max(newMaxAge, maxAge);
        }
        expires = Math.round(new Date().getTime() / 1000) + maxAge;
    }

    return { favicon: imageDataUri, faviconExpires: expires };
}

function getImageData(type, buffer) {
    if (!type || !type.includes("image") || buffer.byteLength < 10) {
        return;
    }

    const array = new Uint8Array(buffer);
    let raw = "";
    // Chunked: String.fromCharCode.apply overflows the call stack on large icons.
    for (let i = 0; i < array.length; i += 0x8000) {
        raw += String.fromCharCode.apply(null, array.subarray(i, i + 0x8000));
    }

    return "data:" + type + ";base64," + btoa(raw);
}

export { getImageData };

export default {
    image: toDataURI,
    getFavicon: getFavicon,
};
