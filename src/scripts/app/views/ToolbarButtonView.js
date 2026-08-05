import BB from "backbone";
import { settingsStore } from "../../shared/settings.ts";

const settings = settingsStore();

export default BB.View.extend({
    tagName: "div",
    className: "button",
    initialize: function () {
        const updateButtonState = () => {
            this.el.classList.remove("active");
            if (action.get("state")) {
                if (settings.get(action.get("state"))) {
                    console.log(action.get("state"), settings.get(action.get("state")));
                    this.el.classList.add("active");
                }
            }
        };

        const action = app.actions.get(this.model.get("actionName"));
        if (action.get("icon")) {
            this.el.style.background =
                'url("/images/' + action.get("icon") + '") no-repeat center center';
        }
        if (action.get("glyph")) {
            this.el.textContent = action.get("glyph");
        }

        this.el.dataset.action = this.model.get("actionName");
        this.el.title = action.get("title");
        updateButtonState();
        this.el.view = this;

        settings.on("change", updateButtonState);
    },
});
