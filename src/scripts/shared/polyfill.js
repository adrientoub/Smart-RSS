/**
 * Makes `browser` available in Chromium.
 *
 * Chrome exposes `chrome.*` with callbacks; Firefox exposes `browser.*` with
 * promises. The polyfill wraps the former into the latter, and returns the
 * native object when it is already there, so Firefox is unaffected.
 *
 * Imported first by every entry point, before anything that touches the API.
 * This is a side effect rather than an export because the rest of the code uses
 * `browser` as a global, and the tests rely on it simply being absent.
 */
import browser from "webextension-polyfill";

globalThis.browser ??= browser;
