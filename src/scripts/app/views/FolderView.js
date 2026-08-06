/**
 * @module App
 * @submodule views/FolderView
 */

import TopView from "./TopView.js";
import contextMenus from "../instances/contextMenus.js";
import { iconMarkup } from "../staticdb/icons.ts";
import { updateRecords, idsOf } from "../../shared/dataClient.ts";

/**
 * View for Folder in feed list
 * @class FolderView
 * @constructor
 * @extends views/TopView
 */
const FolderView = TopView.extend({
    /**
     * Set CSS classnames
     * @property className
     * @default 'list-item folder'
     * @type String
     */
    className: "sources-list-item folder",

    template: `<div class="folder-arrow"></div>
            ${iconMarkup("folder", "source-icon closed")}
            ${iconMarkup("folder-open", "source-icon opened")}
            <div class="source-title"></div>
            <div class="source-counter"></div>`,

    /**
     * Reference to view/feedList instance. It should be replaced with require('views/feedList')
     * @property list
     * @default null
     * @type Backbone.View
     */
    list: null,
    events: {
        dblclick: "handleDoubleClick",
        /*'mouseup': 'handleMouseUp',
                'click': 'handleClick',*/
        "click .folder-arrow": "handleClickArrow",
    },

    /**
     * Opens/closes folder by calling handleClickArrow method
     * @method handleDoubleClick
     * @triggered on double click on the folder
     * @param event {MouseEvent}
     */
    handleDoubleClick: function (event) {
        this.handleClickArrow(event);
    },

    /**
     * Shows context menu for folder
     * @method showContextMenu
     * @triggered on right mouse click
     * @param event {MouseEvent}
     */
    showContextMenu: function (event) {
        if (!this.el.classList.contains("selected")) {
            this.list.select(this, event);
        }
        contextMenus.get("folder").currentSource = this.model;
        contextMenus.get("folder").show(event.clientX, event.clientY);
    },

    /**
     * Initializations (*constructor*)
     * @method initialize
     * @param opt {Object} I don't use it, but it is automatically passed by Backbone
     * @param list {Backbone.View} Reference to feedList
     */
    initialize: function (opt, list) {
        this.list = list;
        this.el.view = this;

        this.model.on("destroy", this.handleModelDestroy, this);
        this.model.on("change", this.render, this);
        this.model.on("change:title", this.handleChangeTitle, this);

        this.el.dataset.id = this.model.get("id");
    },

    /**
     * Places folder to its right place after renaming
     * @method handleChangeTitle
     * @triggered when title of folder is changed
     */
    handleChangeTitle: function () {
        const folderViews = [...document.querySelectorAll(".folder")];
        this.list.insertBefore(this.render(), folderViews);

        const feedsInFolder = [
            ...document.querySelectorAll(
                '[data-in-folder="' + CSS.escape(this.model.get("id")) + '"]'
            ),
        ];

        feedsInFolder.forEach((element) => {
            element.parentNode.removeChild(element);
        });
        feedsInFolder.forEach((element) => {
            this.list.placeSource(element.view);
        });
    },

    /**
     * Removes all events bound to bgprocess
     * @method clearEvents
     */
    clearEvents: function () {
        this.model.off("destroy", this.handleModelDestroy, this);
        this.model.off("change", this.render, this);
        this.model.off("change:title", this.handleChangeTitle, this);
    },

    /**
     * If the folder model is removed from DB/Backbone then remove it from DOM as well
     * @method handleModelDestroy
     * @triggered When model is removed from DB/Backbone
     * @param id {Number} ID of closed tab
     */
    handleModelDestroy: function () {
        this.list.destroySource(this);
    },

    /**
     * If user clicks on folder arrow then show/hide its content
     * @method handleClickArrow
     * @triggered  Left click on folder arrow
     * @param event {MouseEvent}
     */
    handleClickArrow: function (event) {
        const opened = !this.model.get("opened");
        updateRecords("folders", idsOf(this.model), { opened: opened });
        const items = document.querySelectorAll(
            '.source[data-in-folder="' + this.model.get("id") + '"]'
        );
        [...items].forEach((item) => {
            item.hidden = !opened;
        });
        event.stopPropagation();
    },

    /**
     * Reference to requestAnimationFrame frame. It is used to prevent multiple render calls in one frame
     * @property renderInterval
     * @type String|Number
     */
    renderInterval: "first-time",

    /**
     * Renders folder view
     * @method render
     */
    render: function () {
        if (this.model.get("count") > 0) {
            this.el.classList.add("has-unread");
        } else {
            this.el.classList.remove("has-unread");
        }

        const data = Object.create(this.model.attributes);
        if (this.model.get("opened")) {
            this.el.classList.add("opened");
        } else {
            this.el.classList.remove("opened");
        }
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }

        const fragment = document.createRange().createContextualFragment(this.template);
        fragment.querySelector(".source-title").textContent = data.title;
        fragment.querySelector(".source-counter").textContent = data.count;
        this.el.appendChild(fragment);

        this.setTitle(this.model.get("count"), this.model.get("countAll"));
        this.el.href = "#";

        return this;
    },

    /**
     * Data to send to middle column (list of articles) when folder is selected
     * @method render
     * @param event {MouseEvent}
     */
    getSelectData: function (event) {
        return {
            action: "new-folder-select",
            value: this.model.id,
            unreadOnly: !!event.altKey,
        };
    },
});

export default FolderView;
