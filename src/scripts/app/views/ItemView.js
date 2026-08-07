/**
 * @module App
 * @submodule views/ItemView
 */

import BB from "backbone";
import dateUtils from "../helpers/dateUtils.js";
import contextMenus from "../instances/contextMenus.js";
import itemTemplate from "../templates/itemView.html";
import { isReadStateOnlyChange } from "../helpers/itemRender.js";

// Parsed once. Cloning a parsed subtree is far cheaper than re-parsing HTML for
// every row, and <template> cannot execute what it holds.
const rowTemplate = document.createElement("template");
rowTemplate.innerHTML = itemTemplate;
import { settingsStore } from "../../shared/settings.ts";
import { updateRecords, idsOf } from "../../shared/dataClient.ts";
import { sources } from "../modules/data.js";

const settings = settingsStore();

/**
 * View of one article item in article list
 * @class ItemView
 * @constructor
 * @extends Backbone.View
 */
const ItemView = BB.View.extend({
    /**
     * Tag name of article item element
     * @property tagName
     * @default 'a'
     * @type String
     */
    tagName: "a",

    /**
     * Class name of article item element
     * @property className
     * @default 'item'
     * @type String
     */
    className: "articles-list-item",

    /**
     * Reference to view/articleList instance. It should be replaced with require('views/articleList')
     * @property list
     * @default null
     * @type Backbone.View
     */
    list: null,

    /**
     * Initializations (*constructor*)
     * @method initialize
     * @param opt {Object} { model, multiple }
     * @param list {Backbone.View} Reference to articleList
     */
    initialize: function (opt, list) {
        this.multiple = opt.multiple;
        this.list = list;
        this.contentRendered = false;
        // this.el.setAttribute('draggable', 'true');
        // Only valid while this row is bound to this model; the list drops the
        // node as soon as the row scrolls out of the window.
        this.el.view = this;
    },

    /**
     * Renders article item view
     * @method render
     * @chainable
     */
    render: function () {
        const classList = this.el.classList;
        classList.remove("pinned");
        classList.remove("unvisited");
        classList.remove("unread");
        classList.remove("one-line");

        if (!this.model.get("visited")) {
            classList.add("unvisited");
        }
        if (this.model.get("unread")) {
            classList.add("unread");
        }
        if (this.model.get("pinned")) {
            classList.add("pinned");
        }
        if (settings.get("lines") === "1") {
            classList.add("one-line");
        }

        // Only once there is content to keep: see isReadStateOnlyChange.
        if (this.contentRendered && isReadStateOnlyChange(this.model.changedAttributes())) {
            return this;
        }

        const article = this.model.toJSON();
        article.datetime = new Date(article.date).toISOString();
        article.date = this.getItemDate(article.date);
        if (this.multiple) {
            // The feed can be missing briefly: articles and sources reach this
            // context as separate messages. Throwing here would leave a blank row.
            const source = sources.get(this.model.get("sourceID"));
            if (source) {
                article.sourceTitle = source.get("title");
                if (settings.get("displayFaviconInsteadOfPin")) {
                    article.favicon = source.get("favicon");
                }
                article.author =
                    article.sourceTitle !== article.author
                        ? article.sourceTitle + " - " + article.author
                        : article.author;
            }
        }
        this.el.setAttribute("href", article.url);
        if (settings.get("showFullHeadline")) {
            this.el.classList.add("full-headline");
        } else {
            this.el.setAttribute("title", article.title);
        }

        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }

        const fragment = rowTemplate.content.cloneNode(true);
        const itemPin = fragment.querySelector(".item-pin");
        const icon = itemPin.querySelector(".icon");
        if (typeof article.favicon !== "undefined") {
            icon.src = article.favicon;
        } else {
            itemPin.removeChild(icon);
        }
        fragment.querySelector(".item-author").textContent = article.author;
        fragment.querySelector(".item-title").textContent = article.title;
        fragment.querySelector(".item-date").textContent = article.date;
        fragment.querySelector(".item-date").setAttribute("datetime", article.datetime);

        this.el.appendChild(fragment);
        this.contentRendered = true;

        return this;
    },

    /**
     * Returns formatted date according to user settings and time interval
     * @method getItemDate
     * @param date {Number} UTC time
     * @return String
     */
    getItemDate: function (date) {
        const dateFormats = { normal: "DD.MM.YYYY", iso: "YYYY-MM-DD", us: "MM/DD/YYYY" };
        const pickedFormat =
            dateFormats[settings.get("dateType") || "normal"] || dateFormats["normal"];

        const timeFormat = settings.get("hoursFormat") === "12h" ? "H:mm a" : "hh:mm";

        if (date) {
            if (settings.get("fullDate")) {
                date = dateUtils.formatDate(date, pickedFormat + " " + timeFormat);
            } else if (
                Math.floor(dateUtils.formatDate(date, "T") / 86400000) >=
                Math.floor(dateUtils.formatDate(Date.now(), "T") / 86400000)
            ) {
                date = dateUtils.formatDate(date, timeFormat);
            } else if (new Date(date).getFullYear() === new Date().getFullYear()) {
                date = dateUtils.formatDate(date, pickedFormat.replace(/\/?YYYY(?!-)/, ""));
            } else {
                date = dateUtils.formatDate(date, pickedFormat);
            }
        }

        return date;
    },

    /**
     * Shows context menu on right click
     * @method handleMouseUp
     * @triggered on mouse up + condition for right click only
     * @param event {MouseEvent}
     */
    handleMouseUp: function (event) {
        if (event.button === 2) {
            this.showContextMenu(event);
        }
    },

    /**
     * Shows context menu for article item
     * @method showContextMenu
     * @param event {MouseEvent}
     */
    showContextMenu: function (event) {
        if (!this.el.classList.contains("selected")) {
            this.list.select(this, event);
        }
        contextMenus.get("items").currentSource = this.model;
        contextMenus.get("items").show(event.clientX, event.clientY);
    },

    /**
     * Changes pin state (true/false)
     * @method when user clicked on pin button in article item
     * @triggered when model is destroyed
     */
    handleClickPin: function (event) {
        event.stopPropagation();
        updateRecords("items", idsOf(this.model), { pinned: !this.model.get("pinned") });
    },
});

export default ItemView;
