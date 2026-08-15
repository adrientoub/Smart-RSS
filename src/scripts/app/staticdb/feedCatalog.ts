/**
 * The built-in feed marketplace catalog.
 *
 * Hand-curated and shipped with the extension: there is no remote index to
 * fetch, so browsing it works offline and leaks nothing about the user.
 *
 * Titles and descriptions are deliberately left untranslated - they are the
 * publishers' own names, and translating them would mean 120 locale keys that
 * only ever restate English.
 */

export type CatalogCategory =
    "news" | "tech" | "dev" | "science" | "design" | "gaming" | "business" | "culture";

export interface CatalogFeed {
    /** The feed document itself. */
    url: string;
    title: string;
    description: string;
    /** The publisher's home page. */
    site: string;
    /**
     * Icon URL, when `<site>/favicon.ico` does not serve one.
     *
     * Every entry here was checked by loading it in a browser; the ones without
     * it were checked too and answer on the standard path.
     */
    favicon?: string;
    category: CatalogCategory;
}

export interface CatalogCategoryInfo {
    id: CatalogCategory;
    /** Key in the locale catalogs. */
    labelKey: string;
}

export const catalogCategories: readonly CatalogCategoryInfo[] = [
    { id: "news", labelKey: "CATEGORY_NEWS" },
    { id: "tech", labelKey: "CATEGORY_TECHNOLOGY" },
    { id: "dev", labelKey: "CATEGORY_DEVELOPMENT" },
    { id: "science", labelKey: "CATEGORY_SCIENCE" },
    { id: "design", labelKey: "CATEGORY_DESIGN" },
    { id: "gaming", labelKey: "CATEGORY_GAMING" },
    { id: "business", labelKey: "CATEGORY_BUSINESS" },
    { id: "culture", labelKey: "CATEGORY_CULTURE" },
];

export const feedCatalog: readonly CatalogFeed[] = [
    // News
    {
        url: "https://feeds.bbci.co.uk/news/world/rss.xml",
        title: "BBC News — World",
        description: "International headlines from the BBC's global newsroom.",
        site: "https://www.bbc.com/news",
        category: "news",
    },
    {
        url: "https://feeds.npr.org/1001/rss.xml",
        title: "NPR News",
        description: "Top stories from American public radio, updated through the day.",
        site: "https://www.npr.org",
        category: "news",
    },
    {
        url: "https://www.theguardian.com/world/rss",
        title: "The Guardian — World",
        description: "World news and long-form reporting from the Guardian.",
        site: "https://www.theguardian.com",
        category: "news",
    },
    {
        url: "https://www.aljazeera.com/xml/rss/all.xml",
        title: "Al Jazeera",
        description: "Global coverage with a focus on the Middle East, Africa and Asia.",
        site: "https://www.aljazeera.com",
        category: "news",
    },
    {
        url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        title: "The New York Times",
        description: "The Times home page feed: politics, business, culture and more.",
        site: "https://www.nytimes.com",
        category: "news",
    },
    {
        url: "https://rss.dw.com/rdf/rss-en-all",
        title: "Deutsche Welle",
        description: "German public broadcasting in English, strong on European affairs.",
        site: "https://www.dw.com",
        category: "news",
    },
    {
        url: "https://www.france24.com/en/rss",
        title: "France 24",
        description: "French international news channel, English edition.",
        site: "https://www.france24.com/en/",
        category: "news",
    },
    {
        url: "https://www.cbc.ca/webfeed/rss/rss-topstories",
        title: "CBC News",
        description: "Canada's public broadcaster: national and international top stories.",
        site: "https://www.cbc.ca/news",
        favicon: "https://gem.cbc.ca/favicon.ico",
        category: "news",
    },
    {
        url: "https://www.economist.com/latest/rss.xml",
        title: "The Economist",
        description: "Weekly analysis of world politics, economics and business.",
        site: "https://www.economist.com",
        category: "news",
    },
    {
        url: "https://www.lemonde.fr/en/rss/une.xml",
        title: "Le Monde in English",
        description: "France's paper of record, translated for English readers.",
        site: "https://www.lemonde.fr/en/",
        category: "news",
    },

    // Technology
    {
        url: "https://feeds.arstechnica.com/arstechnica/index",
        title: "Ars Technica",
        description: "Deeply reported technology news, reviews and explainers.",
        site: "https://arstechnica.com",
        category: "tech",
    },
    {
        url: "https://www.theverge.com/rss/index.xml",
        title: "The Verge",
        description: "Consumer technology, gadgets and the culture around them.",
        site: "https://www.theverge.com",
        category: "tech",
    },
    {
        url: "https://news.ycombinator.com/rss",
        title: "Hacker News",
        description: "The Y Combinator front page: links programmers are arguing about.",
        site: "https://news.ycombinator.com",
        category: "tech",
    },
    {
        url: "https://lobste.rs/rss",
        title: "Lobsters",
        description: "A small, invite-only link aggregator focused on computing.",
        site: "https://lobste.rs",
        category: "tech",
    },
    {
        url: "https://techcrunch.com/feed/",
        title: "TechCrunch",
        description: "Startup funding, product launches and the venture business.",
        site: "https://techcrunch.com",
        favicon:
            "https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png?w=32",
        category: "tech",
    },
    {
        url: "https://www.engadget.com/rss.xml",
        title: "Engadget",
        description: "Gadget news and hands-on reviews across consumer electronics.",
        site: "https://www.engadget.com",
        favicon: "https://s.yimg.com/kw/assets/favicon-160x160.png",
        category: "tech",
    },
    {
        url: "https://www.wired.com/feed/rss",
        title: "WIRED",
        description: "Technology's effect on culture, science, politics and business.",
        site: "https://www.wired.com",
        category: "tech",
    },
    {
        url: "https://www.technologyreview.com/feed/",
        title: "MIT Technology Review",
        description: "Emerging technology explained by MIT's magazine.",
        site: "https://www.technologyreview.com",
        favicon:
            "https://www.technologyreview.com/static/media/favicon.1cfcdb44759a0f93ddf5feb5405dd4cc.ico",
        category: "tech",
    },
    {
        url: "https://rss.slashdot.org/Slashdot/slashdotMain",
        title: "Slashdot",
        description: "News for nerds, stuff that matters — running since 1997.",
        site: "https://slashdot.org",
        category: "tech",
    },
    {
        url: "https://hackaday.com/feed/",
        title: "Hackaday",
        description: "Hardware hacks, electronics projects and reverse engineering.",
        site: "https://hackaday.com",
        category: "tech",
    },
    {
        url: "https://www.404media.co/rss/",
        title: "404 Media",
        description: "Journalist-owned reporting on technology, power and the internet.",
        site: "https://www.404media.co",
        category: "tech",
    },
    {
        url: "https://daringfireball.net/feeds/main",
        title: "Daring Fireball",
        description: "John Gruber's long-running commentary on Apple and the web.",
        site: "https://daringfireball.net",
        category: "tech",
    },
    {
        url: "https://www.theregister.com/headlines.atom",
        title: "The Register",
        description: "Enterprise IT news with a sardonic British edge.",
        site: "https://www.theregister.com",
        category: "tech",
    },
    {
        url: "https://www.tomshardware.com/feeds.xml",
        title: "Tom's Hardware",
        description: "PC components, benchmarks and build advice.",
        site: "https://www.tomshardware.com",
        category: "tech",
    },

    // Software development
    {
        url: "https://developer.mozilla.org/en-US/blog/rss.xml",
        title: "MDN Blog",
        description: "Web platform documentation, standards and browser guidance.",
        site: "https://developer.mozilla.org",
        category: "dev",
    },
    {
        url: "https://hacks.mozilla.org/feed/",
        title: "Mozilla Hacks",
        description: "Deep dives into web technology from Mozilla's engineers.",
        site: "https://hacks.mozilla.org",
        favicon: "https://www.mozilla.org/media/img/favicons/mozilla/favicon.ico",
        category: "dev",
    },
    {
        url: "https://github.blog/feed/",
        title: "The GitHub Blog",
        description: "Product changes, engineering write-ups and open source news.",
        site: "https://github.blog",
        favicon: "https://github.githubassets.com/favicon.ico",
        category: "dev",
    },
    {
        url: "https://blog.rust-lang.org/feed.xml",
        title: "Rust Blog",
        description: "Official release announcements and RFC news for Rust.",
        site: "https://blog.rust-lang.org",
        favicon: "https://blog.rust-lang.org/images/favicon-32x32.png",
        category: "dev",
    },
    {
        url: "https://go.dev/blog/feed.atom",
        title: "The Go Blog",
        description: "Language design notes and releases from the Go team.",
        site: "https://go.dev/blog/",
        category: "dev",
    },
    {
        url: "https://v8.dev/blog.atom",
        title: "V8 JavaScript Engine",
        description: "How Chrome's JavaScript and WebAssembly engine actually works.",
        site: "https://v8.dev",
        category: "dev",
    },
    {
        url: "https://developer.chrome.com/static/blog/feed.xml",
        title: "Chrome for Developers",
        description: "New web platform features as they land in Chrome.",
        site: "https://developer.chrome.com",
        favicon:
            "https://www.gstatic.com/devrel-devsite/prod/vfaab1c846319b03545a380628f94a5f2242cc1b4a1f651e46c0205139cef731f/chrome/images/favicon.png",
        category: "dev",
    },
    {
        url: "https://nodejs.org/en/feed/blog.xml",
        title: "Node.js Blog",
        description: "Releases, security advisories and project news for Node.js.",
        site: "https://nodejs.org",
        category: "dev",
    },
    {
        url: "https://blog.python.org/feeds/posts/default",
        title: "Python Insider",
        description: "Announcements from the CPython core development team.",
        site: "https://blog.python.org",
        category: "dev",
    },
    {
        url: "https://stackoverflow.blog/feed/",
        title: "Stack Overflow Blog",
        description: "Essays and interviews about how developers really work.",
        site: "https://stackoverflow.blog",
        category: "dev",
    },
    {
        url: "https://jvns.ca/atom.xml",
        title: "Julia Evans",
        description: "Friendly, illustrated explanations of systems and networking.",
        site: "https://jvns.ca",
        category: "dev",
    },
    {
        url: "https://martinfowler.com/feed.atom",
        title: "Martin Fowler",
        description: "Software architecture, refactoring and delivery practice.",
        site: "https://martinfowler.com",
        category: "dev",
    },
    {
        url: "https://overreacted.io/rss.xml",
        title: "Overreacted",
        description: "Dan Abramov on React, JavaScript and thinking about code.",
        site: "https://overreacted.io",
        favicon: "https://overreacted.io/icon.png",
        category: "dev",
    },
    {
        url: "https://simonwillison.net/atom/everything/",
        title: "Simon Willison's Weblog",
        description: "Daily notes on Python, SQLite and large language models.",
        site: "https://simonwillison.net",
        category: "dev",
    },
    {
        url: "https://lwn.net/headlines/newrss",
        title: "LWN.net",
        description: "Authoritative reporting on the Linux kernel and free software.",
        site: "https://lwn.net",
        category: "dev",
    },
    {
        url: "https://devblogs.microsoft.com/oldnewthing/feed/",
        title: "The Old New Thing",
        description: "Raymond Chen on Windows internals and why things are the way they are.",
        site: "https://devblogs.microsoft.com/oldnewthing/",
        favicon:
            "https://devblogs.microsoft.com/oldnewthing/wp-content/uploads/sites/38/2021/03/Microsoft-Favicon.png",
        category: "dev",
    },
    {
        url: "https://devblogs.microsoft.com/typescript/feed/",
        title: "TypeScript Blog",
        description: "Release notes and language design news for TypeScript.",
        site: "https://devblogs.microsoft.com/typescript/",
        favicon: "https://www.typescriptlang.org/favicon-32x32.png",
        category: "dev",
    },
    {
        url: "https://android-developers.googleblog.com/feeds/posts/default",
        title: "Android Developers Blog",
        description: "Platform releases, APIs and tooling for Android.",
        site: "https://android-developers.googleblog.com",
        category: "dev",
    },

    // Science
    {
        url: "https://www.quantamagazine.org/feed/",
        title: "Quanta Magazine",
        description: "Mathematics, physics and biology reported without the hype.",
        site: "https://www.quantamagazine.org",
        favicon:
            "https://www.quantamagazine.org/wp-content/themes/quanta2024/frontend/images/favicon.png",
        category: "science",
    },
    {
        url: "https://www.nature.com/nature.rss",
        title: "Nature",
        description: "Research highlights and news from the journal Nature.",
        site: "https://www.nature.com",
        favicon:
            "https://www.nature.com/static/images/favicons/nature/favicon-32x32-3fe59ece92.png",
        category: "science",
    },
    {
        url: "https://phys.org/rss-feed/",
        title: "Phys.org",
        description: "Daily coverage of physics, space and earth science papers.",
        site: "https://phys.org",
        favicon: "https://phys.b-cdn.net/tmpl/v6/img/favicons/favicon-96x96.png",
        category: "science",
    },
    {
        url: "https://www.nasa.gov/feed/",
        title: "NASA",
        description: "Missions, discoveries and imagery straight from the agency.",
        site: "https://www.nasa.gov",
        favicon:
            "https://www.nasa.gov/wp-content/plugins/nasa-hds-core-setup/assets/favicons/favicon-32x32.png",
        category: "science",
    },
    {
        url: "https://www.sciencedaily.com/rss/top/science.xml",
        title: "ScienceDaily",
        description: "Press-release digest across every scientific discipline.",
        site: "https://www.sciencedaily.com",
        category: "science",
    },
    {
        url: "https://www.newscientist.com/feed/home/",
        title: "New Scientist",
        description: "Weekly science and technology reporting for a wide audience.",
        site: "https://www.newscientist.com",
        favicon:
            "https://www.newscientist.com/wp-content/themes/newscientist/images/favicon/ns-favicon-white-32x32.png",
        category: "science",
    },
    {
        url: "https://www.scientificamerican.com/platform/syndication/rss/",
        title: "Scientific American",
        description: "Science journalism from the oldest magazine in the field.",
        site: "https://www.scientificamerican.com",
        category: "science",
    },
    {
        url: "https://apod.nasa.gov/apod.rss",
        title: "Astronomy Picture of the Day",
        description: "One image of the cosmos each day, explained by an astronomer.",
        site: "https://apod.nasa.gov",
        category: "science",
    },

    // Design
    {
        url: "https://www.smashingmagazine.com/feed/",
        title: "Smashing Magazine",
        description: "Practical front-end, UX and accessibility articles.",
        site: "https://www.smashingmagazine.com",
        category: "design",
    },
    {
        url: "https://css-tricks.com/feed/",
        title: "CSS-Tricks",
        description: "CSS techniques, layout patterns and browser quirks.",
        site: "https://css-tricks.com",
        category: "design",
    },
    {
        url: "https://alistapart.com/main/feed/",
        title: "A List Apart",
        description: "Standards, craft and the practice of designing for the web.",
        site: "https://alistapart.com",
        favicon:
            "https://i0.wp.com/alistapart.com/wp-content/uploads/2019/03/cropped-icon_navigation-laurel-512.jpg?fit=32%2C32&quality=89&ssl=1",
        category: "design",
    },
    {
        url: "https://www.nngroup.com/feed/rss/",
        title: "Nielsen Norman Group",
        description: "Evidence-based usability research and interface guidelines.",
        site: "https://www.nngroup.com",
        favicon: "https://media.nngroup.com/static/img/favicon.ico",
        category: "design",
    },
    {
        url: "https://uxdesign.cc/feed",
        title: "UX Collective",
        description: "Practitioner essays on product and interaction design.",
        site: "https://uxdesign.cc",
        category: "design",
    },

    // Gaming
    {
        url: "https://www.eurogamer.net/feed",
        title: "Eurogamer",
        description: "European games journalism: reviews, news and features.",
        site: "https://www.eurogamer.net",
        category: "gaming",
    },
    {
        url: "https://www.rockpapershotgun.com/feed",
        title: "Rock Paper Shotgun",
        description: "PC gaming coverage with a distinctly opinionated voice.",
        site: "https://www.rockpapershotgun.com",
        category: "gaming",
    },
    {
        url: "https://www.polygon.com/feed/",
        title: "Polygon",
        description: "Games, film and television seen as popular culture.",
        site: "https://www.polygon.com",
        favicon: "https://www.polygon.com/public/build/images/favicon-48x48.png",
        category: "gaming",
    },
    {
        url: "https://www.pcgamer.com/rss/",
        title: "PC Gamer",
        description: "Hardware, reviews and news for people who play on a PC.",
        site: "https://www.pcgamer.com",
        category: "gaming",
    },
    {
        url: "https://www.gamedeveloper.com/rss.xml",
        title: "Game Developer",
        description: "Post-mortems and craft articles written for people who make games.",
        site: "https://www.gamedeveloper.com",
        category: "gaming",
    },
    {
        url: "https://www.ign.com/rss/articles/feed",
        title: "IGN",
        description: "Broad games and entertainment coverage, reviews included.",
        site: "https://www.ign.com",
        category: "gaming",
    },

    // Business
    {
        url: "https://www.ft.com/rss/home/international",
        title: "Financial Times",
        description: "Global business, markets and economic policy.",
        site: "https://www.ft.com",
        favicon:
            "https://www.ft.com/__origami/service/image/v2/images/raw/ftlogo-v1%3Abrand-ft-logo-square-coloured?source=update-logos&width=32&height=32&format=png",
        category: "business",
    },
    {
        url: "http://feeds.hbr.org/harvardbusiness",
        title: "Harvard Business Review",
        description: "Management research translated into practice.",
        site: "https://hbr.org",
        category: "business",
    },
    {
        url: "https://stratechery.com/feed/",
        title: "Stratechery",
        description: "Ben Thompson on the strategy behind technology businesses.",
        site: "https://stratechery.com",
        category: "business",
    },
    {
        url: "https://marginalrevolution.com/feed",
        title: "Marginal Revolution",
        description: "Economics, books and links from Tyler Cowen and Alex Tabarrok.",
        site: "https://marginalrevolution.com",
        favicon:
            "https://marginalrevolution.com/wp-content/uploads/2015/10/cropped-MR-logo-thumbnail-32x32.png",
        category: "business",
    },

    // Culture
    {
        url: "https://www.theatlantic.com/feed/all/",
        title: "The Atlantic",
        description: "Essays and reporting on politics, culture and ideas.",
        site: "https://www.theatlantic.com",
        category: "culture",
    },
    {
        url: "https://aeon.co/feed.rss",
        title: "Aeon",
        description: "Long-form philosophy, psychology and science essays.",
        site: "https://aeon.co",
        category: "culture",
    },
    {
        url: "https://longreads.com/feed/",
        title: "Longreads",
        description: "A curated pick of the best long-form journalism on the web.",
        site: "https://longreads.com",
        favicon:
            "https://longreads.com/wp-content/uploads/2017/01/longreads-logo-sm-rgb-150x150.png",
        category: "culture",
    },
    {
        url: "https://www.theparisreview.org/blog/feed/",
        title: "The Paris Review Daily",
        description: "Literature, interviews and the writing life.",
        site: "https://www.theparisreview.org",
        category: "culture",
    },
    {
        url: "https://feeds.kottke.org/main",
        title: "kottke.org",
        description: "Jason Kottke's long-running blog of interesting things.",
        site: "https://kottke.org",
        category: "culture",
    },
    {
        url: "https://www.openculture.com/feed",
        title: "Open Culture",
        description: "Free books, courses, films and archival curiosities.",
        site: "https://www.openculture.com",
        favicon: "https://www.openculture.com/wp-content/themes/openculture_v4a/images/favicon.ico",
        category: "culture",
    },
    {
        url: "https://xkcd.com/rss.xml",
        title: "xkcd",
        description: "A webcomic of romance, sarcasm, math and language.",
        site: "https://xkcd.com",
        category: "culture",
    },
    {
        url: "https://www.newyorker.com/feed/everything",
        title: "The New Yorker",
        description: "Reporting, criticism, fiction and cartoons.",
        site: "https://www.newyorker.com",
        category: "culture",
    },
    {
        url: "https://publicdomainreview.org/rss.xml",
        title: "The Public Domain Review",
        description: "Curious artefacts and artworks that have entered the public domain.",
        site: "https://publicdomainreview.org",
        category: "culture",
    },
];
