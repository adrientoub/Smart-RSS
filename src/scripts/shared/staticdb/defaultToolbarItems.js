export default [
    {
        version: 2,
        region: "feeds",
        actions: [
            "feeds:addSource",
            "feeds:addFolder",
            "feeds:updateAll",
            "feeds:delete",
            "!dynamicSpace",
            "feeds:toggleShowOnlyUnread",
        ],
    },
    {
        version: 1,
        region: "articles",
        actions: [
            "articles:markAllAsRead",
            "articles:update",
            "articles:undelete",
            "articles:delete",
            "!dynamicSpace",
            "articles:toggleShowOnlyUnread",
            "articles:search",
        ],
    },
    {
        version: 3,
        region: "content",
        actions: [
            "content:mark",
            "content:delete",
            "!dynamicSpace",
            "content:changeView",
            "content:toggleTheme",
            "content:showConfig",
        ],
    },
];
