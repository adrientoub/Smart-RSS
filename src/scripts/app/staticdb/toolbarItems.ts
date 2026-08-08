export type ToolbarItem = `${string}:${string}` | "!dynamicSpace";

export const toolbarItems = {
    feeds: [
        "feeds:addSource",
        "feeds:addFolder",
        "feeds:updateAll",
        "feeds:delete",
        "!dynamicSpace",
        "feeds:toggleShowOnlyUnread",
        "feeds:toggleFeedList",
    ],
    articles: [
        "articles:markAllAsRead",
        "articles:update",
        "articles:undelete",
        "articles:delete",
        "!dynamicSpace",
        "articles:toggleShowOnlyUnread",
        "articles:search",
    ],
    content: [
        "content:mark",
        "content:undelete",
        "content:delete",
        "!dynamicSpace",
        "content:changeView",
        "content:toggleTheme",
        "content:showConfig",
    ],
} as const satisfies Record<string, readonly ToolbarItem[]>;
