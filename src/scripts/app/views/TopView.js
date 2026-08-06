import BB from "backbone";
import Locale from "../modules/Locale.js";
import topViewTemplate from "../templates/topView.html";
import { iconMarkup } from "../staticdb/icons.ts";

export default BB.View.extend({
    tagName: "a",
    template: topViewTemplate
        .replace("{{LOADING_ICON}}", iconMarkup("loader", "source-icon loading"))
        .replace("{{BROKEN_ICON}}", iconMarkup("alert-triangle", "source-icon broken")),
    className: "sources-list-item",
    handleMouseUp: function (e) {
        if (e.button === 2) {
            this.showContextMenu(e);
        }
    },
    getSelectData: function (e) {
        return {
            action: "new-select",
            value: this.model.id || Object.assign({}, this.model.get("filter")),
            name: this.model.get("name"),
            unreadOnly: !!e.altKey,
        };
    },
    setTitle: function (unread, total) {
        this.el.setAttribute(
            "title",
            this.model.get("title") +
                " (" +
                unread +
                " " +
                Locale.UNREAD +
                ", " +
                total +
                " " +
                Locale.TOTAL +
                ")"
        );
    },
});
