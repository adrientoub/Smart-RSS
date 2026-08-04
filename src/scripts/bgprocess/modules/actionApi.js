/**
 * @module BgProcess
 * @submodule modules/actionApi
 *
 * MV2 exposes the toolbar button as `browserAction`, MV3 renamed it to `action`
 * and renamed the matching context-menu context along with it. Resolving both
 * here keeps the call sites identical across manifest versions.
 */

const isMV3 = typeof browser.action !== "undefined";

export default {
    action: isMV3 ? browser.action : browser.browserAction,
    menuContext: isMV3 ? "action" : "browser_action",
};
