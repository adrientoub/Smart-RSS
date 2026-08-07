# Build

Requires Node.js 20 or newer.

```bash
npm install
```

## Develop

```bash
npm run check   # eslint + tsc --noEmit + tests. Run this before committing.
npm run build   # bundle into dist/
npm run dev     # build, then launch Firefox with the extension loaded
npm run dev:edge # build, then launch Edge with the extension loaded
npm run watch   # rebuild on change, run alongside npm run dev
```

`npm run dev` loads `dist/` as a temporary add-on. Inspect the background from
`about:debugging#/runtime/this-firefox`.

`npm run dev:edge` rebuilds `dist/` with the Chromium manifest and runs it in Edge
through web-ext's Chromium target. Inspect the service worker from `edge://extensions`
with developer mode on. It expects Edge at its default Windows location; override
`--chromium-binary` in the script if it lives elsewhere.

## Individual checks

```bash
npm run lint          npm run lint:fix
npm run typecheck     npm run lint:ext      # web-ext lint against dist/
npm test              npm run format        # npm run format:check to only report
```

## Release

```bash
npm run package        # target-specific Firefox and Chromium zips in artifacts/
npm run bump-version   # patch, or pass minor or major
npm run release        # bump, commit, build, zip
```

The packages are named `SmartRSS_v<version>_firefox.zip` and
`SmartRSS_v<version>_chromium.zip`. `release:minor` and `release:major` bump that level
instead.

Every command also works as `node build.js <command>`.
