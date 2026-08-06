# Smart RSS extension

## Now officially unmaintained, I _may_ fix some critical issue if any is found within few following weeks, but then I'll archive this repo. Feel free to fork and continue development as you wish

Originally developed for Opera 15+ by BS-Harou (Martin Kadlec)

Translations are WebExtension message catalogs in `src/_locales/*/messages.json`.

For technical bug reports use issues here on GitHub

## For users

Extension is available in following repositories:

#### AMO: https://addons.mozilla.org/firefox/addon/smart-rss-reader/

~~#### Chrome Web Store: https://chrome.google.com/webstore/detail/eggggihfcaabljfpjiiaohloefmgejic/~~

If you encounter issue with a specific feed for best results please back up and include current state of that feed in your report, this will be helpful in case the feed changes before I get to check it, thanks in advance

## For developers

Clone the repository, then see [BUILD.md](BUILD.md) to build and run it.

Every locale must contain the same keys as the English catalog. Missing translations should temporarily use the English message so the catalogs remain structurally complete. If you change wording or punctuation, explain conventions specific to that language in the pull request.

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
