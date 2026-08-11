import BB from "backbone";
import { createIcon } from "../staticdb/icons.ts";
import type { ToolbarItem } from "../staticdb/toolbarItems.ts";
import Locale from "../modules/Locale.js";
import { settingsStore } from "../../shared/settings.ts";
import { info } from "../modules/data.js";

const settings = settingsStore();

interface ToolbarOptions extends Backbone.ViewOptions {
    actions: readonly ToolbarItem[];
}

const ToolbarView = BB.View.extend({
    tagName: "div",
    className: "toolbar",
    actions: [] as readonly ToolbarItem[],
    events: {
        "click .button": "handleAction",
        "input input[type=search]": "handleAction",
    },

    initialize: function (options: ToolbarOptions) {
        this.actions = options.actions;
        this.render();
        this.hideItems("articles:undelete");
        this.hideItems("content:undelete");
        settings.on("change", this.updateButtonStates, this);
        info.on("change:allCountUnread", this.updateUnreadCount, this);
    },

    render: function () {
        this.el.replaceChildren(...this.actions.map((item: ToolbarItem) => this.createItem(item)));
        this.updateButtonStates();
        return this;
    },

    createItem: function (item: ToolbarItem): HTMLElement {
        if (item === "!dynamicSpace") {
            const spacer = document.createElement("div");
            spacer.className = "dynamic-space";
            return spacer;
        }

        const action = app.actions.get(item);
        if (item === "articles:search") {
            const search = document.createElement("input");
            search.className = "input-search";
            search.type = "search";
            search.tabIndex = -1;
            search.placeholder = Locale.SEARCH;
            search.dataset.action = item;
            search.title = action.get("title");
            return search;
        }

        const button = document.createElement("div");
        button.className = "button";
        button.dataset.action = item;
        if (item === "articles:toggleShowOnlyUnread") {
            const count = document.createElement("span");
            count.className = "toolbar-unread-count";
            button.appendChild(count);
        }
        return button;
    },

    updateButtonStates: function () {
        const buttons = this.el.querySelectorAll(
            ".button[data-action]"
        ) as NodeListOf<HTMLElement>;
        buttons.forEach((button) => {
            const action = app.actions.get(button.dataset.action);
            const state = action.get("state");
            const icon = action.get("icon");
            const title = action.get("title");

            button.classList.toggle("active", Boolean(state && settings.get(state)));
            button.title = typeof title === "function" ? title() : title;
            const iconName = typeof icon === "function" ? icon() : icon;
            const currentIcon = button.querySelector<HTMLElement>("[data-icon]");
            if (iconName && currentIcon?.dataset.icon !== iconName) {
                const element = createIcon(iconName, "button-icon");
                element?.setAttribute("data-icon", iconName);
                currentIcon?.remove();
                if (element) {
                    button.prepend(element);
                }
            }
        });
        this.updateUnreadCount();
    },

    updateUnreadCount: function () {
        const count = this.el.querySelector(".toolbar-unread-count") as HTMLElement | null;
        if (count) {
            count.textContent = String(info.get("allCountUnread") ?? 0);
        }
    },

    handleAction: function (event: Event) {
        const action = (event.currentTarget as HTMLElement).dataset.action;
        if (action) {
            app.actions.execute(action, event);
        }
    },

    hideItems: function (action: string) {
        this.findItems(action).forEach((item: HTMLElement) => (item.hidden = true));
        return this;
    },

    showItems: function (action: string) {
        this.findItems(action).forEach((item: HTMLElement) => (item.hidden = false));
        return this;
    },

    findItems: function (action: string): HTMLElement[] {
        const items = this.el.querySelectorAll("[data-action]") as NodeListOf<HTMLElement>;
        return [...items].filter((item) => item.dataset.action === action);
    },

    remove: function () {
        settings.off("change", this.updateButtonStates, this);
        info.off("change:allCountUnread", this.updateUnreadCount, this);
        return BB.View.prototype.remove.call(this);
    },
});

export default ToolbarView;
