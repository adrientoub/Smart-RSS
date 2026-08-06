import BB from "backbone";
import { createIcon } from "../staticdb/icons.ts";

export default BB.View.extend({
    tagName: "div",
    className: "context-menu-item",
    contextMenu: null,
    events: {
        click: "handleClick",
    },
    initialize: function () {
        if (this.model.id) {
            this.el.id = this.model.id;
        }
    },
    render: function () {
        // Items without an icon keep an empty slot so every label lines up.
        const icon =
            createIcon(this.model.get("icon"), "context-menu-icon") ||
            Object.assign(document.createElement("span"), { className: "context-menu-icon" });

        const label = document.createElement("span");
        label.className = "context-menu-label";
        label.textContent = this.model.get("title");

        this.el.replaceChildren(icon, label);
        return this;
    },
    handleClick: function (e) {
        const action = this.model.get("action");
        if (action && typeof action === "function") {
            action(e, app.feeds.feedList);
        }
        this.contextMenu.hide();
    },
});
