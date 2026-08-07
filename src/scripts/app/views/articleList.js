/**
 * @module App
 * @submodule views/articleList
 */

import BB from "backbone";
import {
    Virtualizer,
    elementScroll,
    measureElement,
    observeElementOffset,
    observeElementRect,
} from "@tanstack/virtual-core";
import Group from "../models/Group.js";
import ItemView from "./ItemView.js";
import Locale from "../modules/Locale.js";
import { settingsStore } from "../../shared/settings.ts";
import { updateRecords, trashItems, markItemsDeleted, idsOf } from "../../shared/dataClient.ts";
import { pendingFocus, takePendingFocus } from "../modules/focus.js";
import { findInsertionIndex } from "../helpers/insertionIndex.js";
import { buildRows, groupTitleByRow, itemRowIndexes } from "../helpers/rowModel.ts";
import { findSiblingIndex } from "../helpers/listNavigation.ts";
import { sources, items } from "../modules/data.js";

const settings = settingsStore();

/** Kept in sync with `.date-group` in main.css. */
const GROUP_HEIGHT = 21;

/** Only used until a row of that kind has actually been measured. */
const ESTIMATED_ITEM_HEIGHT = 44;

const ROWS_OVERSCAN = 6;

const modelOf = (target) => (target && target.model ? target.model : target) || null;

/**
 * List of articles.
 *
 * Only the rows inside the scroll window exist in the document; everything else
 * is the row model in `rows`, so selection and keyboard navigation are index
 * arithmetic over state rather than sibling walks over the DOM.
 *
 * @class ArticleListView
 * @constructor
 * @extends Backbone.View
 */
const ArticleListView = BB.View.extend({
    /**
     * Tag name of article list element
     * @property tagName
     * @default 'div'
     * @type String
     */
    tagName: "div",

    /**
     * ID of article list
     * @property id
     * @default 'article-list'
     * @type String
     */
    id: "article-list",

    /**
     * Class of article views
     * @property itemClass
     * @default 'item'
     * @type string
     */
    itemClass: "articles-list-item",

    /**
     * Data received from feedList about current selection (feed ids, name of special, filter, unreadOnly)
     * @property currentData
     * @default { feeds: [], name: 'all-feeds', filter: { trashed: false}, unreadOnly: false }
     * @type Object
     */
    currentData: {
        feeds: [],
        name: "all-feeds",
        filter: { trashed: false },
        unreadOnly: false,
    },

    events: {
        // 'dragstart .articles-list-item': 'handleDragStart',
        "mousedown .articles-list-item": "handleMouseDown",
        "click .articles-list-item": "handleClick",
        "mouseup .articles-list-item": "handleMouseUp",
        "dblclick .articles-list-item": "handleItemDblClick",
        "mousedown .item-pin,.item-pinned": "handleClickPin",
    },

    /**
     * Opens articles url in new tab
     * @method handleItemDblClick
     * @triggered on double click on article
     */
    handleItemDblClick: function () {
        app.actions.execute("articles:oneFullArticle");
    },

    handleMouseDown(event) {
        if (event.button === 1) {
            const linkElement = event.target.closest("a");
            if (this.prefetcher && linkElement?.href) {
                this.prefetcher.href = linkElement.href;
                if (!this.prefetcher.isConnected) {
                    document.head.appendChild(this.prefetcher);
                }
            }
        }
    },

    /**
     * Selects article
     * @method handleClick
     * @triggered on click on article
     * @param event {MouseEvent}
     */
    handleClick: function (event) {
        this.handleSelectableMouseDown(event);
    },

    /**
     * Changes pin state
     * @method handleClickPin
     * @triggered on click on pin button
     * @param event {MouseEvent}
     */
    handleClickPin: function (event) {
        event.currentTarget.parentNode.view.handleClickPin(event);
    },

    /**
     * Calls necessary select methods
     * @method handleMouseUp
     * @triggered on mouse up on article
     * @param event {MouseEvent}
     */
    handleMouseUp: function (event) {
        event.currentTarget.view.handleMouseUp(event);
        this.handleSelectableMouseUp(event);
    },

    /**
     * Called when new instance is created
     * @method initialize
     */
    initialize: function () {
        if (typeof browser !== "undefined") {
            this.prefetcher = document.createElement("link");
            this.prefetcher.rel = "preload";
            this.prefetcher.setAttribute("as", "fetch");
            this.prefetcher.setAttribute("crossorigin", "crossorigin");
        }

        /** Every article of the current feed selection, in comparator order. */
        this.allItems = [];
        /** Membership of `allItems`, valid between rebuilds. */
        this.allIds = new Set();
        /** `allItems` minus whatever the search box filters out. */
        this.visibleItems = [];
        this.searchFilter = null;
        this.rows = [];
        this.rowKeys = [];
        this.rowGroupTitles = [];
        this.itemRows = [];
        this.itemIndexById = new Map();
        /** key -> { row, el, view }, only for rows inside the rendered window. */
        this.renderedRows = new Map();
        this.multiple = false;
        this.estimatedItemHeight = ESTIMATED_ITEM_HEIGHT;
        this.itemHeightMeasured = false;

        this.selectedIds = [];
        this.selectedSet = new Set();
        this.selectedItems = [];
        this.selectPivotId = null;
        this.lastSelectedId = null;
        this.selectFlag = false;

        this.nextFrameStore = [];
        this.nextFrame = null;
        this.renderQueued = false;
        this.rebuildQueued = false;
        this.pendingSelectId = null;
        this.rendering = false;

        this.buildScaffolding();
        this.createVirtualizer();

        items.on("add", this.handleItemAdded, this);
        items.on("change", this.handleItemChanged, this);
        items.on("destroy", this.handleItemDestroyed, this);
        items.on("sort", this.handleSort, this);
        items.on("search", this.handleSearch, this);
        sources.on("destroy", this.handleSourcesDestroy, this);
        settings.on("change", this.onSettingsChange, this);

        this.on("attach", this.handleAttached, this);
        this.on("pick", this.handlePick, this);
    },

    /**
     * The scroller holds a spacer sized to the whole list; the rows that exist
     * are absolutely positioned inside it.
     * @method buildScaffolding
     */
    buildScaffolding: function () {
        // The `.date-group` rows are positioned, so they cannot be sticky
        // themselves; one overlay stands in for all of them.
        this.stickyEl = document.createElement("div");
        this.stickyEl.className = "date-group-sticky";
        this.stickyEl.hidden = true;
        this.stickyLabel = document.createElement("div");
        this.stickyLabel.className = "date-group";
        this.stickyEl.appendChild(this.stickyLabel);

        this.sizerEl = document.createElement("div");
        this.sizerEl.className = "articles-list-sizer";

        this.el.appendChild(this.stickyEl);
        this.el.appendChild(this.sizerEl);
    },

    /**
     * @method createVirtualizer
     */
    createVirtualizer: function () {
        this.virtualizerOptions = {
            count: 0,
            overscan: ROWS_OVERSCAN,
            getScrollElement: () => this.el,
            estimateSize: (index) =>
                this.rows[index] && this.rows[index].type === "group"
                    ? GROUP_HEIGHT
                    : this.estimatedItemHeight,
            getItemKey: (index) => this.rowKeys[index] ?? index,
            scrollToFn: elementScroll,
            observeElementRect,
            observeElementOffset,
            measureElement,
            onChange: () => this.renderWindow(),
        };
        this.virtualizer = new Virtualizer(this.virtualizerOptions);
        this.virtualizer._didMount();
    },

    onSettingsChange: function () {
        this.unreadOnly = settings.get("defaultToUnreadOnly");
        this.handleNewSelected(this.currentData);
    },

    /**
     * Sends msg to show selected article
     * @method handlePick
     * @triggered when one article is selected
     * @param handle {Object} selection handle carrying the picked model
     */
    handlePick: function (handle) {
        const model = modelOf(handle);
        if (!model || !model.collection) {
            // This shouldn't usually happen
            // It might happen when source is deleted and created in the same tick
            return;
        }
        app.trigger("select:" + this.el.id, { action: "new-select", value: model.id });

        if (model.get("unread") && settings.get("readOnVisit")) {
            updateRecords("items", idsOf(model), {
                visited: true,
                unread: false,
            });
        } else if (!model.get("visited")) {
            updateRecords("items", idsOf(model), { visited: true });
        }
    },

    /**
     * Sets comm event listeners
     * @method handleAttached
     * @triggered when article list is attached to DOM
     */
    handleAttached: function () {
        app.on(
            "select:feed-list",
            function (data) {
                this.el.scrollTop = 0;
                this.unreadOnly = settings.get("defaultToUnreadOnly");

                if (data.action === "new-select") {
                    this.handleNewSelected(data);
                }
            },
            this
        );

        app.on(
            "give-me-next",
            function () {
                if (this.selectedItems[0] && this.selectedItems[0].model.get("unread") === true) {
                    updateRecords("items", idsOf(this.selectedItems[0].model), { unread: false });
                }
                this.selectNextSelectable({ selectUnread: true });
                app.actions.execute("content:focus");
            },
            this
        );

        this.renderWindow();

        if (pendingFocus()) {
            setTimeout(function () {
                app.trigger("focus-feed", takePendingFocus());
            }, 0);
            return;
        }
        if (settings.get("selectAllFeeds") && settings.get("showAllFeeds")) {
            this.loadAllFeeds();
        }
    },

    /**
     * Loads all untrashed feeds
     * @method loadAllFeeds
     * @chainable
     */
    loadAllFeeds: function () {
        setTimeout(() => {
            const unread = items.where({ trashed: false, unread: true });

            if (unread.length) {
                this.addItems(unread);
            } else {
                this.addItems(items.where({ trashed: false }));
            }
            const event = new MouseEvent("mousedown", {
                view: window,
                bubbles: true,
                cancelable: true,
            });

            const cb = document.querySelector(".special");
            cb.dispatchEvent(event);
        }, 0);

        return this;
    },

    /**
     * Re-runs the search box over the list
     * @method handleSearch
     * @triggered when new items are added or when a source is destroyed
     */
    handleSearch: function () {
        if (document.querySelector('input[type="search"]').value.trim() !== "") {
            app.actions.execute("articles:search");
        }
    },

    /**
     * Clears searchbox and sorts the list
     * @method handleSort
     * @triggered when sort setting is changed
     */
    handleSort: function () {
        document.querySelector('input[type="search"]').value = "";
        this.handleNewSelected(this.currentData);
    },

    /**
     * Tests whether newly fetched item should be added to current list.
     * (If the item's feed is selected)
     * @method inCurrentData
     * @return Boolean
     * @param item {Item} Item
     */
    inCurrentData: function (item) {
        const feeds = this.currentData.feeds;
        if (!feeds.length) {
            if (!this.currentData.filter) {
                return true;
            } else if (item.query(this.currentData.filter)) {
                return true;
            }
        } else if (feeds.indexOf(item.get("sourceID")) >= 0) {
            return true;
        }

        return false;
    },

    /* ------------------------------------------------------------------ *
     * Row model
     * ------------------------------------------------------------------ */

    /**
     * Rebuilds the interleaved row array and repaints the visible window.
     * @method rebuildRows
     */
    rebuildRows: function () {
        const grouped =
            !settings.get("disableDateGroups") &&
            settings.get("sortBy") === "date" &&
            this.visibleItems.length > 0;

        this.rows = buildRows(
            this.visibleItems,
            (model) => model.get("date"),
            grouped ? (date) => Group.getGroup(date).title : null
        );
        this.rowKeys = this.rows.map((row) =>
            row.type === "group" ? "g:" + row.title : "i:" + row.model.id
        );
        this.rowGroupTitles = grouped ? groupTitleByRow(this.rows) : [];
        this.itemRows = itemRowIndexes(this.rows);

        this.itemIndexById = new Map();
        for (let index = 0; index < this.visibleItems.length; index++) {
            this.itemIndexById.set(this.visibleItems[index].id, index);
        }

        this.virtualizerOptions = { ...this.virtualizerOptions, count: this.rows.length };
        this.virtualizer.setOptions(this.virtualizerOptions);

        this.commitSelection();
        this.renderWindow();
    },

    /* ------------------------------------------------------------------ *
     * Rendering
     * ------------------------------------------------------------------ */

    scheduleRender: function () {
        if (this.renderQueued) {
            return;
        }
        this.renderQueued = true;
        requestAnimationFrame(() => {
            this.renderQueued = false;
            this.renderWindow();
        });
    },

    /**
     * Materializes exactly the rows the virtualizer asks for and drops the rest.
     * @method renderWindow
     */
    renderWindow: function () {
        // Measuring a row can change the total size, which notifies back in here.
        if (this.rendering) {
            this.scheduleRender();
            return;
        }
        this.rendering = true;
        try {
            this.virtualizer._willUpdate();
            const virtualRows = this.virtualizer.getVirtualItems();
            this.sizerEl.style.height = this.virtualizer.getTotalSize() + "px";

            const live = new Set();
            for (const virtualRow of virtualRows) {
                const row = this.rows[virtualRow.index];
                if (!row) {
                    continue;
                }
                live.add(virtualRow.key);

                let entry = this.renderedRows.get(virtualRow.key);
                if (!entry) {
                    entry = this.createRow(row);
                    this.renderedRows.set(virtualRow.key, entry);
                    this.sizerEl.appendChild(entry.el);
                }
                entry.el.dataset.index = String(virtualRow.index);
                entry.el.style.transform = "translateY(" + virtualRow.start + "px)";
                this.virtualizer.measureElement(entry.el);
            }

            let dropped = false;
            for (const [key, entry] of this.renderedRows) {
                if (!live.has(key)) {
                    this.releaseRow(entry);
                    this.renderedRows.delete(key);
                    dropped = true;
                }
            }
            if (dropped) {
                // Prunes the virtualizer's element cache of the nodes just removed.
                this.virtualizer.measureElement(null);
            }

            this.updateStickyGroup(virtualRows);
            this.calibrateItemHeight();
        } finally {
            this.rendering = false;
        }
    },

    /**
     * @method createRow
     * @param row {Object} row descriptor from the row model
     */
    createRow: function (row) {
        if (row.type === "group") {
            const el = document.createElement("div");
            el.className = "date-group";
            el.textContent = row.title;
            return { row, el, view: null };
        }

        const view = new ItemView({ model: row.model, multiple: this.multiple }, this);
        view.render();
        this.applySelectionClasses(view.el, row.model.id);
        return { row, el: view.el, view };
    },

    /**
     * @method releaseRow
     * @param entry {Object} rendered row entry
     */
    releaseRow: function (entry) {
        if (entry.el.contains(document.activeElement)) {
            // Otherwise focus falls back to <body> and the region, which is what
            // the hotkey table is keyed on, stops being the active one.
            const region = this.el.closest(".region");
            if (region) {
                region.focus({ preventScroll: true });
            }
        }
        if (entry.view) {
            entry.view.stopListening();
        }
        entry.el.remove();
    },

    /**
     * Keeps the date header of the topmost visible row pinned, pushed up by the
     * next header the way `position: sticky` would if the rows were in flow.
     * @method updateStickyGroup
     * @param virtualRows {Array} the virtualizer's current window
     */
    updateStickyGroup: function (virtualRows) {
        if (!this.rowGroupTitles.length || !virtualRows.length) {
            this.stickyEl.hidden = true;
            return;
        }

        const offset = this.el.scrollTop;
        const topRow = virtualRows.find((row) => row.end > offset) || virtualRows[0];
        const title = this.rowGroupTitles[topRow.index];
        if (!title) {
            this.stickyEl.hidden = true;
            return;
        }

        const next = virtualRows.find(
            (row) => row.start > offset && this.rows[row.index]?.type === "group"
        );
        const push = next ? Math.min(0, next.start - offset - GROUP_HEIGHT) : 0;

        this.stickyEl.hidden = false;
        this.stickyLabel.textContent = title;
        this.stickyEl.style.transform = push ? "translateY(" + push + "px)" : "";
    },

    /**
     * The scrollbar is only as honest as `estimateSize`, so the guess is
     * replaced by the first real row height that appears.
     * @method calibrateItemHeight
     */
    calibrateItemHeight: function () {
        if (this.itemHeightMeasured) {
            return;
        }
        for (const entry of this.renderedRows.values()) {
            if (entry.row.type !== "item") {
                continue;
            }
            const height = entry.el.offsetHeight;
            if (height > 0) {
                this.itemHeightMeasured = true;
                if (Math.abs(height - this.estimatedItemHeight) >= 1) {
                    this.estimatedItemHeight = height;
                    requestAnimationFrame(() => this.virtualizer.measure());
                }
                return;
            }
        }
    },

    /* ------------------------------------------------------------------ *
     * Contents
     * ------------------------------------------------------------------ */

    /**
     * Adds a newly fetched article to the list
     * @method handleItemAdded
     * @param item {Item} Item
     */
    handleItemAdded: function (item) {
        if (!this.inCurrentData(item) || this.allIds.has(item.id)) {
            return;
        }

        const comparator = items.comparator.bind(items);
        this.allIds.add(item.id);
        this.allItems.splice(findInsertionIndex(this.allItems, item, comparator), 0, item);
        if (!this.searchFilter || this.searchFilter(item)) {
            this.visibleItems.splice(
                findInsertionIndex(this.visibleItems, item, comparator),
                0,
                item
            );
        }

        if (this.selectedIds.length === 0 && this.pendingSelectId === null) {
            this.pendingSelectId = item.id;
        }
        // A fetch announces its articles one at a time; rebuilding per article
        // would make loading a feed quadratic again.
        this.scheduleRebuild();
    },

    scheduleRebuild: function () {
        if (this.rebuildQueued) {
            return;
        }
        this.rebuildQueued = true;
        requestAnimationFrame(() => {
            this.rebuildQueued = false;
            this.rebuildRows();

            const pending = this.pendingSelectId;
            this.pendingSelectId = null;
            if (pending !== null && this.selectedIds.length === 0) {
                if (settings.get("selectFirstArticle")) {
                    this.select(this.visibleItems[this.itemIndexById.get(pending)]);
                }
            }
        });
    },

    /**
     * @method handleItemChanged
     * @param item {Item} Item
     */
    handleItemChanged: function (item) {
        if (!this.allIds.has(item.id)) {
            return;
        }
        if (item.get("deleted") || (this.currentData.name !== "trash" && item.get("trashed"))) {
            this.destroyItem(item);
            return;
        }
        const entry = this.renderedRows.get("i:" + item.id);
        if (entry && entry.view) {
            entry.view.render();
        }
    },

    /**
     * @method handleItemDestroyed
     * @param item {Item} Item
     */
    handleItemDestroyed: function (item) {
        this.destroyItem(item);
    },

    /**
     * Replaces the whole list
     * @method addItems
     * @param models {Array} items
     * @param multiple {Boolean} whether the list spans more than one feed
     */
    addItems: function (models, multiple = false) {
        this.multiple = !!multiple;
        this.clearSelection();
        this.searchFilter = null;

        this.allItems = models.filter((item) => this.inCurrentData(item));
        this.allIds = new Set(this.allItems.map((item) => item.id));
        this.visibleItems = this.allItems.slice();
        this.pendingSelectId = null;
        this.el.scrollTop = 0;

        // Row height depends on settings that may have just changed.
        this.itemHeightMeasured = false;
        this.virtualizer.measure();
        this.rebuildRows();

        if (this.visibleItems.length === 0) {
            return;
        }

        if (settings.get("selectFirstArticle")) {
            this.select(this.visibleItems[0]);
        }
        if (document.querySelector('input[type="search"]').value !== "") {
            app.actions.execute("articles:search");
        }
    },

    /**
     * Restricts the list to the articles matching the search box.
     * @method setSearchFilter
     * @param matches {Function|null} predicate over items, or null to clear
     */
    setSearchFilter: function (matches) {
        this.searchFilter = matches || null;
        this.visibleItems = matches ? this.allItems.filter(matches) : this.allItems.slice();
        this.rebuildRows();
    },

    /**
     * Called every time when new feed is selected and before it is rendered
     * @method clearOnSelect
     */
    clearOnSelect: function () {
        // if prev selected was trash, hide undelete buttons
        if (this.currentData.name === "trash") {
            app.articles.toolbar.showItems("articles:update");
            app.articles.toolbar.hideItems("articles:undelete");
            document.querySelector("#context-undelete").hidden = true;
        }

        this.currentData = {
            feeds: [],
            name: "all-feeds",
            filter: { trashed: false },
            unreadOnly: false,
        };
    },

    /**
     * Called every time when new feed is selected. Gets the right data from store.
     * @method handleNewSelected
     * @param data {Object} data object received from feed list
     */
    handleNewSelected: function (data) {
        this.clearOnSelect();
        this.currentData = data;

        const searchIn = data.filter ? items.where(data.filter) : items.where({ trashed: false });

        // if newly selected is trash
        if (this.currentData.name === "trash") {
            app.articles.toolbar.hideItems("articles:update").showItems("articles:undelete");
            document.querySelector("#context-undelete").hidden = false;
        }
        const visible = searchIn.filter((item) => {
            if (!item.get("unread") && this.unreadOnly) {
                return false;
            }
            return data.name || data.feeds.includes(item.get("sourceID"));
        }, this);
        this.addItems(visible, data.multiple);
    },

    /**
     * If current feed is removed, select all feeds
     * @triggered when any source is destroyed
     * @method handleSourcesDestroy
     * @param source {Source} Destroyed source
     */
    handleSourcesDestroy: function (source) {
        const data = this.currentData;
        const index = data.feeds.indexOf(source.id);

        if (index >= 0) {
            data.feeds.splice(index, 1);
        }

        if (!data.feeds.length && !data.filter) {
            this.clearOnSelect();

            if (this.visibleItems.length) {
                this.once(
                    "items-destroyed",
                    () => {
                        this.loadAllFeeds();
                    },
                    this
                );
            } else {
                this.loadAllFeeds();
            }
        }
    },

    /**
     * Moves item from trash back to its original source
     * @method undeleteItem
     * @param target {Object} selection handle or item
     */
    undeleteItem: function (target) {
        const model = modelOf(target);
        updateRecords("items", idsOf(model), { trashed: false });
        this.destroyItem(model);
    },

    /**
     * Moves item to trash
     * @method removeItem
     * @param target {Object} selection handle or item
     */
    removeItem: function (target) {
        const model = modelOf(target);
        const askRmPinned = settings.get("askRmPinned");
        if (model.get("pinned") && askRmPinned === "all") {
            const confirmation = confirm(
                Locale.translate("PINNED_DELETE_CONFIRM", { title: model.get("title") })
            );
            if (!confirmation) {
                return;
            }
        }
        trashItems(idsOf(model));
        this.destroyItem(model);
        this.trigger("items-destroyed");
    },

    /**
     * Removes item from both source and trash leaving only info it has been already fetched and deleted
     * @method removeItemCompletely
     * @param target {Object} selection handle or item
     */
    removeItemCompletely: function (target) {
        const model = modelOf(target);
        const askRmPinned = settings.get("askRmPinned");
        if (model.get("pinned") && askRmPinned && askRmPinned !== "none") {
            const confirmation = confirm(
                Locale.translate("PINNED_DELETE_CONFIRM", { title: model.get("title") })
            );
            if (!confirmation) {
                return;
            }
        }
        markItemsDeleted(idsOf(model));
    },

    /**
     * Calls undeleteItem/removeItem/removeItemCompletely in a batch for several items
     * @method destroyBatch
     * @param arr {Array} List of selection handles
     * @param fn {Function} Function to be called on each handle
     */
    destroyBatch: function (arr, fn) {
        // `fn` moves the selection, which rewrites `selectedItems` underneath us.
        const batch = arr.slice();
        for (let i = 0, j = batch.length; i < j; i++) {
            fn.call(this, batch[i]);
        }
    },

    /**
     * Queues an article for removal from the list. The removal is deferred so a
     * batch delete only moves the selection once.
     * @method destroyItem
     * @param target {Object} selection handle or item
     */
    destroyItem: function (target) {
        const model = modelOf(target);
        if (!model || !this.allIds.has(model.id)) {
            return;
        }
        this.nextFrameStore.push(model);
        if (this.nextFrame) {
            return;
        }
        this.nextFrame = requestAnimationFrame(() => {
            const batch = this.nextFrameStore;
            this.nextFrame = null;
            this.nextFrameStore = [];

            // Runs before the rows go, so sibling navigation still has an anchor.
            this.selectAfterDelete(batch[batch.length - 1]);
            this.removeItems(batch);
        });
    },

    /**
     * @method removeItems
     * @param models {Array} items to drop from the list
     */
    removeItems: function (models) {
        const ids = new Set(models.map((model) => model.id));
        this.allItems = this.allItems.filter((model) => !ids.has(model.id));
        this.allIds = new Set(this.allItems.map((model) => model.id));
        this.visibleItems = this.visibleItems.filter((model) => !ids.has(model.id));
        if (ids.has(this.selectPivotId)) {
            this.selectPivotId = null;
        }
        if (ids.has(this.lastSelectedId)) {
            this.lastSelectedId = null;
        }
        this.rebuildRows();
    },

    /**
     * Selects new item when the last selected is deleted
     * @method selectAfterDelete
     * @param model {Item}
     */
    selectAfterDelete: function (model) {
        const index = this.itemIndexById.get(model.id);
        if (index === this.visibleItems.length - 1) {
            this.selectPrev({ currentIsRemoved: true });
        } else {
            this.selectNextSelectable({ currentIsRemoved: true });
        }
    },

    /**
     * Toggles unread state of selected items (with onlyToRead option)
     * @method changeUnreadState
     * @param options {Object} Options { onlyToRead: bool }
     */
    changeUnreadState: function (options) {
        options = options || {};
        const unread =
            this.selectedItems.length && !options.onlyToRead
                ? !this.selectedItems[0].model.get("unread")
                : false;
        const targets = this.selectedItems
            .filter((item) => !options.onlyToRead || item.model.get("unread") === true)
            .map((item) => item.model);
        updateRecords("items", idsOf(targets), { unread: unread, visited: true });
    },

    /* ------------------------------------------------------------------ *
     * Selection
     *
     * A virtualized row only carries the `selected` class while it happens to
     * be inside the rendered window, so the selection itself lives in state.
     * ------------------------------------------------------------------ */

    clearSelection: function () {
        this.selectedIds = [];
        this.selectPivotId = null;
        this.lastSelectedId = null;
        this.selectFlag = false;
        this.commitSelection();
    },

    /**
     * Publishes the selection: rebuilds `selectedItems` and repaints the classes
     * of whichever rows are currently rendered.
     * @method commitSelection
     */
    commitSelection: function () {
        // The search filter can take rows away under an existing selection.
        this.selectedIds = this.selectedIds.filter((id) => this.itemIndexById.has(id));
        if (this.selectPivotId !== null && !this.itemIndexById.has(this.selectPivotId)) {
            this.selectPivotId = null;
        }
        if (this.lastSelectedId !== null && !this.itemIndexById.has(this.lastSelectedId)) {
            this.lastSelectedId = null;
        }
        this.selectedSet = new Set(this.selectedIds);
        this.selectedItems = this.selectedIds.map((id) => ({
            model: this.visibleItems[this.itemIndexById.get(id)],
        }));

        for (const entry of this.renderedRows.values()) {
            if (entry.row.type === "item") {
                this.applySelectionClasses(entry.el, entry.row.model.id);
            }
        }
    },

    applySelectionClasses: function (el, id) {
        el.classList.toggle("selected", this.selectedSet.has(id));
        el.classList.toggle("last-selected", this.lastSelectedId === id);
    },

    /**
     * @method select
     * @param target {Object} an ItemView, a selection handle or an item
     * @param e {Object} modifier flags, usually a MouseEvent
     * @param forceSelect {Boolean} trigger `pick` even for a shift range
     */
    select: function (target, e = {}, forceSelect = false) {
        const model = modelOf(target);
        if (!model || !this.itemIndexById.has(model.id)) {
            return;
        }
        const id = model.id;
        let pick = false;

        if ((!e.shiftKey && !e.ctrlKey) || (e.shiftKey && !this.selectPivotId)) {
            this.selectedIds = [];
            this.selectPivotId = id;
            pick = true;
        } else if (e.shiftKey && this.selectPivotId) {
            this.selectedIds = [this.selectPivotId];
            if (this.selectPivotId !== id) {
                const pivotIndex = this.itemIndexById.get(this.selectPivotId);
                const targetIndex = this.itemIndexById.get(id);
                const from = Math.min(pivotIndex, targetIndex);
                const to = Math.max(pivotIndex, targetIndex);
                for (let index = from; index <= to; index++) {
                    const between = this.visibleItems[index].id;
                    if (between !== this.selectPivotId && between !== id) {
                        this.selectedIds.push(between);
                    }
                }
            }
            pick = forceSelect === true;
        } else if (e.ctrlKey && this.selectedSet.has(id)) {
            this.selectedIds = this.selectedIds.filter((selected) => selected !== id);
            this.selectPivotId = null;
            if (this.lastSelectedId === id) {
                this.lastSelectedId = null;
            }
            this.commitSelection();
            return;
        } else if (e.ctrlKey) {
            this.selectPivotId = id;
        }

        if (this.selectedIds[0] !== id) {
            this.selectedIds.push(id);
        }
        this.lastSelectedId = id;
        this.commitSelection();

        if (pick) {
            setTimeout(() => this.trigger("pick", { model }, e), 0);
        }
    },

    /**
     * @method selectAll
     */
    selectAll: function () {
        this.selectedIds = this.visibleItems.map((model) => model.id);
        this.selectPivotId = this.selectedIds.length ? this.selectedIds[0] : null;
        this.lastSelectedId = this.selectedIds.length
            ? this.selectedIds[this.selectedIds.length - 1]
            : null;
        this.commitSelection();
    },

    selectNextSelectable: function (e) {
        this.selectSibling(e, 1);
    },

    selectPrev: function (e) {
        this.selectSibling(e, -1);
    },

    /**
     * @method selectSibling
     * @param e {Object} { selectUnread, currentIsRemoved, ctrlKey, shiftKey }
     * @param direction {Number} 1 for the next row, -1 for the previous one
     */
    selectSibling: function (e, direction) {
        e = e || {};
        const count = this.visibleItems.length;
        const anchorId =
            e.selectUnread && this.selectPivotId !== null
                ? this.selectPivotId
                : this.lastSelectedId;
        const anchor = anchorId === null ? undefined : this.itemIndexById.get(anchorId);
        const from = anchor === undefined ? (direction === 1 ? -1 : count) : anchor;

        const isSelectable = e.selectUnread
            ? (index) => this.visibleItems[index].get("unread") === true
            : () => true;
        const circular = !!settings.get("circularNavigation") && !e.ctrlKey && !e.shiftKey;

        let index = findSiblingIndex(count, from, direction, isSelectable, circular);
        if (
            index >= 0 &&
            e.currentIsRemoved &&
            this.visibleItems[index].id === this.lastSelectedId
        ) {
            index = -1;
        }

        if (index < 0) {
            if (e.currentIsRemoved) {
                app.trigger("no-items:" + this.el.id);
            }
            return;
        }

        this.select(this.visibleItems[index], e, true);
        this.scrollItemIntoView(index, true);
    },

    /**
     * @method scrollItemIntoView
     * @param itemIndex {Number} index into the visible item array
     * @param focus {Boolean} move keyboard focus onto the row
     */
    scrollItemIntoView: function (itemIndex, focus = false) {
        const rowIndex = this.itemRows[itemIndex];
        if (rowIndex === undefined) {
            return;
        }
        this.virtualizer.scrollToIndex(rowIndex, { align: "auto" });
        this.renderWindow();

        if (!focus) {
            return;
        }
        const focusRow = () => {
            const entry = this.renderedRows.get(this.rowKeys[rowIndex]);
            if (entry) {
                entry.el.focus({ preventScroll: true });
            }
        };
        if (this.renderedRows.has(this.rowKeys[rowIndex])) {
            focusRow();
        } else {
            // The scroll only reaches the virtualizer through a scroll event, so
            // a row well outside the window is not there to focus yet.
            requestAnimationFrame(focusRow);
        }
    },

    handleSelectableMouseDown: function (event) {
        if (event.which === 2) {
            return true;
        }
        event.preventDefault();
        const view = event.currentTarget.view;
        if (
            this.selectedIds.length > 1 &&
            this.selectedSet.has(view.model.id) &&
            !event.ctrlKey &&
            !event.shiftKey
        ) {
            this.selectFlag = true;
            return false;
        }
        this.select(view, event);
        return false;
    },

    handleSelectableMouseUp: function (event) {
        if (event.which === 1 && this.selectedIds.length > 1 && this.selectFlag) {
            this.select(event.currentTarget.view, event);
            this.selectFlag = false;
        }
    },
});

export default new ArticleListView();
