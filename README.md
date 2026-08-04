# Smart RSS extension

## Now officially unmaintained, I _may_ fix some critical issue if any is found within few following weeks, but then I'll archive this repo. Feel free to fork and continue development as you wish

Originally developed for Opera 15+ by BS-Harou (Martin Kadlec)

Translations are in scripts/nls/\*.js

For technical bug reports use issues here on GitHub

## For users

Extension is available in following repositories:

#### AMO: https://addons.mozilla.org/firefox/addon/smart-rss-reader/

~~#### Chrome Web Store: https://chrome.google.com/webstore/detail/eggggihfcaabljfpjiiaohloefmgejic/~~

If you encounter issue with a specific feed for best results please back up and include current state of that feed in your report, this will be helpful in case the feed changes before I get to check it, thanks in advance

## For developers

Clone the repository, then see [BUILD.md](BUILD.md) to build and run it.

Sometimes you may encounter texts ending with `*` or `!` in app, first ones are fallbacks to English text when used locale lacks the needed one and the latter are actual keys displayed when even English text is missing, feel free to submit PR's to fill them. If you change wording or punctuation somewhere please comment that line (using GitHub interface) with reasoning like common conventions or special punctuation rules in given language.

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
