# Smarter RSS

Smarter RSS is an upgraded version of Smart RSS: a three-pane browser extension that
fetches, stores and renders your subscriptions entirely locally, with no account and no
server.

It builds on [zakius/Smart-RSS](https://github.com/zakius/Smart-RSS), itself a
continuation of the reader originally developed for Opera 15+ by BS-Harou (Martin
Kadlec), while modernizing the interface, architecture and browser support.

## What Smarter RSS upgrades

- **JavaScript → TypeScript.** New code is written in TypeScript; the remaining `.js`
  files are converted opportunistically as they are touched.
- **Manifest V3.** Firefox and Chromium are both targeted, with a non-persistent
  background (event page on Firefox, service worker on Chromium) and separate packaging
  per engine.
- **Backbone → React.** The UI is React over typed, immutable record stores instead of
  Backbone models and views. See [docs/backbone-migration.md](docs/backbone-migration.md).
- **Faster.** The article list is virtualized, storage moved to Dexie/IndexedDB, and the
  code is bundled with esbuild instead of being loaded module-by-module by RequireJS.
- **Themes** driven by CSS colour tokens — light, dark, OLED dark, sepia and nord, or
  whatever the browser asks for — plus an SVG icon set that follows the theme.

## Stack

- TypeScript, ESM modules, no ambient globals
- React 19 with `@tanstack/react-virtual` for the article list
- Dexie (IndexedDB) for storage
- `@rgrove/parse-xml` for feed parsing, `@mozilla/readability` for article extraction
- `webextension-polyfill` for cross-browser extension APIs
- esbuild for bundling, `web-ext` for running and linting
- ESLint, Prettier, `tsc --noEmit`, and `node:test` with native type stripping

## For users

If you encounter an issue with a specific feed, please back up and include the current
state of that feed in your report; this helps in case the feed changes before it can be
checked. For technical bug reports use the issues here on GitHub.

## For developers

Clone the repository, then see [BUILD.md](BUILD.md) to build and run it.

Translations are WebExtension message catalogs in `src/_locales/*/messages.json`. Every locale must contain the same keys as the English catalog. Missing translations should temporarily use the English message so the catalogs remain structurally complete. If you change wording or punctuation, explain conventions specific to that language in the pull request.

### Code Quality

- **Prettier** handles formatting
- **ESLint** checks for logical and semantic issues
- **TypeScript** type-checks, loosely; new code is written in TypeScript

```
npm run check
```

runs all three plus the tests, and is what needs to pass before committing.

### Build System

See [BUILD.md](BUILD.md).
