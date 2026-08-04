/**
 * @module BgProcess
 * @submodule modules/actionApi
 *
 * MV2 exposes the toolbar button as `browserAction`, MV3 renamed it to `action`.
 * Resolving both here keeps the call sites identical across manifest versions.
 */

const isMV3 = typeof browser.action !== "undefined";

export default {
    action: isMV3 ? browser.action : browser.browserAction,
};
