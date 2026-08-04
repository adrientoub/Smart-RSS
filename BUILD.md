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
npm run watch   # rebuild on change, run alongside npm run dev
```

`npm run dev` loads `dist/` as a temporary add-on. Inspect the background page from
`about:debugging#/runtime/this-firefox`.

Chromium is not usable yet: the manifest is still `manifest_version: 2`.

## Individual checks

```bash
npm run lint          npm run lint:fix
npm run typecheck     npm run lint:ext      # web-ext lint against dist/
npm test              npm run format        # npm run format:check to only report
```

## Release

```bash
npm run package        # minified build plus dist/SmartRSS_v<version>.zip
npm run bump-version   # patch, or pass minor or major
npm run release        # bump, commit, build, zip
```

`release:minor` and `release:major` bump that level instead.

Every command also works as `node build.js <command>`.
