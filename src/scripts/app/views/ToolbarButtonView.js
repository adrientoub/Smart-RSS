import BB from "backbone";
import { createIcon } from "../staticdb/icons.ts";
import { settingsStore } from "../../shared/settings.ts";

const settings = settingsStore();

export default BB.View.extend({
    tagName: "div",
    className: "button",
    iconName: null,
    initialize: function () {
        const action = app.actions.get(this.model.get("actionName"));
        const icon = action.get("icon");

        const updateButtonState = () => {
            this.el.classList.toggle(
                "active",
                Boolean(action.get("state") && settings.get(action.get("state")))
            );
            // A function icon lets a button draw itself from the current state.
            if (typeof icon === "function") {
                this.setIcon(icon());
            }
        };

        if (typeof icon === "string") {
            this.setIcon(icon);
        }

        this.el.dataset.action = this.model.get("actionName");
        this.el.title = action.get("title");
        updateButtonState();
        this.el.view = this;

        settings.on("change", updateButtonState);
    },
    setIcon: function (name) {
        if (this.iconName === name) {
            return;
        }
        this.iconName = name;
        const icon = createIcon(name, "button-icon");
        this.el.replaceChildren(...(icon ? [icon] : []));
    },
});
