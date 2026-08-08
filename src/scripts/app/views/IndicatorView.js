/**
 * @module App
 * @submodule views/IndicatorView
 */

import BB from "backbone";
import Locale from "../modules/Locale.js";
import indicatorView from "../templates/indicatorView.html";
import { iconMarkup } from "../staticdb/icons.ts";

const template = indicatorView.replace("{{STOP_ICON}}", iconMarkup("stop", "button-icon"));

/**
 * Feeds update indicator view
 * @class IndicatorView
 * @constructor
 * @extends Backbone.View
 */
const IndicatorView = BB.View.extend({
    /**
     * Indicator element id
     * @property id
     * @default indicator
     */
    id: "indicator",
    events: {
        "click #indicator-stop": "handleButtonStop",
    },

    /**
     * @method initialize
     */
    initialize: function () {
        this.loaded = 0;
        this.maxSources = 0;
        const fragment = document.createRange().createContextualFragment(template);
        this.el.appendChild(fragment);
        const port = browser.runtime.connect({ name: "port-from-cs" });
        port.onMessage.addListener((m) => {
            if (m.key === "loading") {
                this.loading = m.value;
            }
            if (m.key === "loaded") {
                this.loaded = m.value;
            }
            if (m.key === "maxSources") {
                this.maxSources = m.value;
            }
            this.render();
        });

        this.render();
    },

    /**
     * Stops updating feeds
     * @method handleButtonStop
     * @triggered when user clicks on stop button
     */
    handleButtonStop: function () {
        app.actions.execute("feeds:stopUpdate");
    },

    /**
     * Renders the indicator (gradient/text)
     * @method render
     * @chainable
     */
    render: function () {
        this.el.classList.add("indicator-visible");

        const { loaded, maxSources } = this;
        if (maxSources === 0 || !this.loading) {
            this.el.classList.add("indicator-invisible");
            return;
        }
        const percentage = Math.round((loaded * 100) / maxSources);
        const progress = this.el.querySelector("#indicator-progress");
        progress.style.setProperty("--indicator-progress", percentage + "%");
        progress.setAttribute("aria-valuenow", String(percentage));
        this.el.querySelector("#indicator-label").textContent =
            Locale.UPDATING_FEEDS + " (" + loaded + "/" + maxSources + ")";
        this.el.classList.remove("indicator-invisible");
        return this;
    },
});

export default IndicatorView;
