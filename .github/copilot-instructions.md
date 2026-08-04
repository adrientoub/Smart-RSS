# Smart RSS

A browser extension RSS reader (Firefox today, Chromium and Manifest V3 in progress).

## Language: new code is TypeScript

**Write every new file in TypeScript (`.ts`). Do not add new `.js` files under `src/`.**

This works today with no build changes:

- esbuild resolves an import of `./thing.js` to `./thing.ts`, so a file can be renamed
  without touching any importer.
- **Keep the `.js` extension in import specifiers**, even when the target is a `.ts`
  file. That is what both esbuild and `moduleResolution: "bundler"` expect.

Existing `.js` files are migrated **opportunistically**, not in bulk:

- Converting a file you are already substantially changing is welcome.
- A mass `.js` → `.ts` rename is not. `checkJs` across the tree still reports ~280
  errors, ~160 of them in the Backbone view layer, where `View.extend({...})` and
  untyped `model.get("x")` mean annotations buy little until the model layer is typed.
- To type-check an existing `.js` file without renaming it, add `// @ts-check` at the top.

Typing is deliberately loose (`strict: false`, `checkJs: false`). Prefer accurate narrow
types on new code, but do not tighten `tsconfig.json` globally without discussion.

## Verify before claiming done

```
npm run check    # eslint + tsc --noEmit + node:test
npm run build    # esbuild bundle into dist/
```

Both must pass. `npm run check` is the gate; lint warnings are tolerated, errors are not.

Nothing in this project is currently verified in a real browser. If a change could affect
runtime behaviour, say so plainly and list what needs manual testing rather than implying
it works.

## Architecture notes

- **Modules are ESM.** RequireJS and `src/scripts/libs/` are gone; third-party code comes
  from npm and is bundled by `build.js` (esbuild).
- **`src/scripts/globals.d.ts`** declares the ambient globals (`bg`, `settings`, `sources`,
  `items`, ...) that the MV2 background page assigns onto `window`. These are legacy and
  disappear with the MV3 message-passing refactor. **Do not add new ambient globals.**
- **`src/scripts/` is ESM, the repo root is CommonJS.** `build.js` is CommonJS. `test/` and
  `src/scripts/` each carry a `package.json` with `"type": "module"`.
- Anything under `src/scripts/` is bundled; everything else in `src/` is copied verbatim.
  A file placed outside `src/scripts/` will ship inside the extension.
- TypeScript is pinned to 6.0.x because `typescript-eslint` v8 caps it below 6.1.

## Tests

`node:test` with native TypeScript type stripping, in `test/*.test.ts`. No test framework.
Favour pure functions that can be tested directly; export a helper if that makes it
testable, as `getImageData` in `favicon.js` does.

When a test reveals surprising existing behaviour, encode the real behaviour and label it
as a known limitation. Do not assert what the code _should_ do and leave it failing.

## Pull requests

Work is delivered as **stacked PRs**, one reviewable concern per layer:

```
gh stack view                       # inspect
gh stack add <branch>               # new layer on top
gh pr create --base <layer below> --body-file <file>
gh stack link --remote fork <branches bottom-to-top>
```

- `$env:GH_REPO = "adrientoub/Smart-RSS"` is required: `gh` otherwise resolves the
  upstream parent repo, which is archived and read-only.
- `gh stack submit` opens an interactive editor and will hang a non-interactive shell.
- Write PR bodies to a file and pass `--body-file`. Do not pipe `gh api --jq '.body'`
  through PowerShell and back; it collapses newlines and corrupts UTF-8.
- Keep unrelated changes out of a layer, including incidental reformatting.

There is no CI. The `check` and `build` scripts are the only gate.

## Manifest V3 migration

The target is a single build running on both Firefox and Chromium. Remaining blockers,
roughly in order:

1. `DOMParser` in `RSSParser.js` and `favicon.js` — service workers have no DOM
2. `document.createRange()` article diffing in `FeedLoader.js`
3. `new Audio()` in `Loader.js` — needs an offscreen document on Chromium
4. `browser.runtime.getBackgroundPage()` — replace with typed message passing
5. The `manifest_version: 3` flip, `host_permissions`, `webextension-polyfill`, `_locales`

Prefer changes that work under MV2 _and_ MV3 so they can ship incrementally. When an API
differs between manifest versions, resolve it once behind a small shim, as
`bgprocess/modules/actionApi.js` does — a bare rename usually breaks MV2.
