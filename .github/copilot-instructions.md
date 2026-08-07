# Smart RSS

A browser extension RSS reader (Firefox today, Chromium and Manifest V3 in progress).

## Language: new code is TypeScript

**Write every new file in TypeScript (`.ts`). Do not add new `.js` files under `src/`.**

This works today with no build changes:

- **Use the real file extension in import specifiers.** Import a `.ts` module as
  `./thing.ts` and a `.js` module as `./thing.js`. esbuild, `tsc` and Node's ESM loader
  all agree on that.
- Do not write `./thing.js` when the file is really `./thing.ts`. esbuild and `tsc`
  tolerate it, but **Node does not**, so any test importing that module fails to
  resolve. `allowImportingTsExtensions` is enabled precisely so the real extension
  can be used everywhere.

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

Automated checks never exercise the extension. Run it before claiming runtime behaviour
works:

```
npm run dev       # build, then launch Firefox with the extension and devtools
npm run dev:edge  # build a Chromium manifest, then launch Edge from dist/
npm run lint:ext  # web-ext lint against dist/ (0 errors expected)
npm run watch     # rebuild src -> dist in another terminal; web-ext reloads on change
```

`npm run dev` loads `dist/` as a temporary add-on. The background runs as an event page
with its own console, reachable from `about:debugging#/runtime/this-firefox` via
"Inspect". `npm run dev:edge` rebuilds `dist/` for Edge, where the background is a
service worker inspectable from `edge://extensions`.

If a change could affect runtime behaviour and you have not run it, say so plainly and
list what needs manual testing rather than implying it works.

## Architecture notes

- **Modules are ESM.** RequireJS and `src/scripts/libs/` are gone; third-party code comes
  from npm and is bundled by `build.js` (esbuild).
- **`src/scripts/globals.d.ts`** declares `app`, the last ambient global, assigned by
  `app/app.js` and read by the views. **Do not add new ambient globals.**
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

CI runs the checks and uploads separate Firefox and Chromium packages.

## Manifest V3

The manifest is V3, but Firefox and Chromium need separate build outputs. The source
manifest carries `service_worker` for Chromium and `scripts` for Firefox, which has no
service worker support. Chromium packaging removes `scripts` and Firefox-only metadata.

**The background is not persistent on either.** It is torn down when idle and
restarted for whichever event comes first, so:

- Register every listener synchronously at the top level of `bg.js`. A listener
  added from a `.then()` misses the event that started the worker.
- Everything that touches the collections must `await appStarted` first, which is
  what `whenStarted()` wraps the message handlers in.
- Anything done on startup must be idempotent: context menus are removed before
  being created, and the scheduler alarm is only created when absent, because
  re-creating an alarm restarts its period and it would never come due.
- The whole database is re-read on every wake, since the background keeps all
  articles in memory. A reader tab holds a `runtime.connect` port open, which
  keeps the worker alive while one is open. Paging the data layer is the real
  fix; it is not done.

On Firefox MV3, `host_permissions` are **not** granted on install. Feed fetching
stays broken until the user allows all sites from the add-on's permissions tab.

`browser` comes from `webextension-polyfill`, loaded for its side effect by
`shared/polyfill.js`, which every entry point imports **first**. Chrome has no
native `browser`; Firefox does, and the polyfill defers to it. Do not import the
package anywhere else — it throws outside an extension, which breaks the tests.
The polyfill also caps argument counts, so callback-style calls such as
`tabs.query(info, cb)` throw in Chromium. Await the promise instead.

The background process does not parse with the DOM: `RSSParser.ts` uses
`@rgrove/parse-xml`, favicons come from `/favicon.ico` directly, and article diffing
uses `articleDiff.ts`. Keep it that way — nothing under `bgprocess/` may use
`DOMParser`, `XMLSerializer`, `document`, `window` or `XMLHttpRequest`. Audio
notifications were removed rather than moved to an offscreen document.
