import BB from "backbone";
import { createIcon } from "../staticdb/icons.ts";
import type { ToolbarItem } from "../staticdb/toolbarItems.ts";
import Locale from "../modules/Locale.js";
import { settingsStore } from "../../shared/settings.ts";

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
        settings.on("change", this.updateButtonStates, this);
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
        button.title = action.get("title");
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

            button.classList.toggle("active", Boolean(state && settings.get(state)));
            const iconName = typeof icon === "function" ? icon() : icon;
            const currentIcon = button.firstElementChild?.getAttribute("data-icon");
            if (iconName && currentIcon !== iconName) {
                const element = createIcon(iconName, "button-icon");
                element?.setAttribute("data-icon", iconName);
                button.replaceChildren(...(element ? [element] : []));
            }
        });
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
        return BB.View.prototype.remove.call(this);
    },
});

export default ToolbarView;
