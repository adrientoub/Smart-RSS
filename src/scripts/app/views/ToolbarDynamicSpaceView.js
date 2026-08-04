import BB from "backbone";

export default BB.View.extend({
    tagName: "div",
    className: "dynamic-space",
    initialize: function () {
        this.el.view = this;
    },
});
