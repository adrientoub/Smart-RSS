import TopView from "./TopView.js";
import specialView from "../templates/specialView.html";
import { info } from "../modules/data.js";

export default TopView.extend({
    className: "sources-list-item special",
    /*events: {
                'mouseup': 'handleMouseUp',
                'click': 'handleClick'
            },*/
    showContextMenu: function (e) {
        if (!this.contextMenu) {
            return;
        }

        if (!this.el.classList.contains("selected")) {
            app.feeds.feedList.select(this, e);
        }
        this.contextMenu.currentSource = this.model;
        this.contextMenu.show(e.clientX, e.clientY);
    },
    initialize: function () {
        this.el.view = this;
        if (this.model.get("onReady")) {
            this.model.get("onReady").call(this);
        }
        info.on("change", this.changeInfo, this);
    },
    clearEvents: function () {
        info.off("change", this.changeInfo, this);
    },
    changeInfo: function () {
        if (this.model.get("name") === "all-feeds") {
            const changed = info.changedAttributes();
            if (changed && typeof changed === "object" && "allCountUnread" in changed) {
                this.render(true);
            }
            this.setTitle(info.get("allCountUnread"), info.get("allCountTotal"));
            return;
        }
        if (this.model.get("name") === "pinned") {
            const changed = info.changedAttributes();
            if (changed && typeof changed === "object" && "pinnedCountUnread" in changed) {
                this.render(true);
            }
            this.setTitle(info.get("pinnedCountUnread"), info.get("pinnedCountTotal"));
            return;
        }
        if (this.model.get("name") === "trash") {
            const tot = info.get("trashCountTotal");
            this.setTitle(info.get("trashCountUnread"), tot);

            /**
             * Change trash icon (0, 1-99, 100+)
             */
            if (tot <= 0 && this.model.get("icon") !== "trashsource.png") {
                this.model.set("icon", "trashsource.png");
                this.render(true);
            } else if (tot > 0 && tot < 100 && this.model.get("icon") !== "trash_full.png") {
                this.model.set("icon", "trash_full.png");
                this.render(true);
            } else if (tot >= 100 && this.model.get("icon") !== "trash_really_full.png") {
                this.model.set("icon", "trash_really_full.png");
                this.render(true);
            }
        }
    },
    render: function (noinfo) {
        this.el.classList.remove("has-unread");
        const data = this.model.toJSON();
        data.count = 0;
        if (this.model.get("name") === "all-feeds") {
            data.count = info.get("allCountUnread");
        }

        if (this.model.get("name") === "pinned") {
            data.count = info.get("pinnedCountUnread");
        }

        if (data.count > 0) {
            this.el.classList.add("has-unread");
        }
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }

        const fragment = document.createRange().createContextualFragment(specialView);
        fragment.querySelector(".source-icon").src = "/images/" + data.icon;
        fragment.querySelector(".source-title").textContent = data.title;
        fragment.querySelector(".source-counter").textContent = data.count;
        this.el.appendChild(fragment);
        this.el.href = "#";

        if (!noinfo) {
            this.changeInfo();
        }
        return this;
    },
});
