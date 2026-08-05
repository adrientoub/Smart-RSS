import BB from "backbone";
import Locale from "../modules/Locale.js";
import propertiesTemplate from "../templates/propertiesView.html";
import propertiesDetails from "../templates/propertiesDetails.html";
import { updateRecords, idsOf } from "../../shared/dataClient.ts";
import { sources, folders } from "../modules/data.js";
import Source, { encodePassword } from "../../shared/models/Source.js";
import Folder from "../../shared/models/Folder.js";

export default BB.View.extend({
    id: "properties",
    current: null,
    events: {
        "click button": "handleClick",
        "keydown button": "handleKeyDown",
    },
    handleClick: function (event) {
        const target = event.currentTarget;
        if (target.id === "prop-cancel") {
            this.hide();
        } else if (target.id === "prop-ok") {
            this.saveData();
        }
    },
    saveData: function () {
        if (!this.current) {
            this.hide();
            return;
        }

        const updateEvery = parseInt(document.querySelector("#prop-update-every").value);
        const autoRemove = parseInt(document.querySelector("#prop-autoremove").value);
        const folderId = document.querySelector("#prop-parent").value;

        if (this.current instanceof Source) {
            const defaultView = document.querySelector("#defaultView").value;

            updateRecords("sources", idsOf(this.current), {
                title: document.querySelector("#prop-title").value,
                url: app.fixURL(document.querySelector("#prop-url").value),
                username: document.querySelector("#prop-username").value,
                password: encodePassword(document.querySelector("#prop-password").value),
                folderID: folderId,
                updateEvery: updateEvery,
                autoremove: autoRemove,
                proxyThroughFeedly: document.querySelector("#prop-proxy").checked,
                openEnclosure: document.querySelector("#openEnclosure").value,
                defaultView: defaultView,
            });
        } else {
            let iterator = [];
            if (this.current instanceof Folder) {
                iterator = sources.where({ folderID: this.current.id });
                updateRecords("folders", idsOf(this.current), {
                    title: document.querySelector("#prop-title").value,
                });
            } else if (Array.isArray(this.current)) {
                iterator = this.current;
            }

            const ids = idsOf(iterator);
            if (updateEvery >= -1) {
                updateRecords("sources", ids, { updateEvery: updateEvery });
            }
            if (autoRemove >= -1) {
                updateRecords("sources", ids, { autoremove: autoRemove });
            }
            if (folderId >= 0) {
                updateRecords("sources", ids, { folderID: folderId });
            }
        }
        this.hide();
    },
    handleKeyDown: function (e) {
        if (e.keyCode === 13) {
            this.handleClick(e);
        }
    },
    initialize: function () {
        this.el.hidden = true;
    },
    renderSource: function () {
        /* decrypt password */
        const properties = this.current.toJSON();
        properties.password = this.current.getPass();

        const fragment = document
            .createRange()
            .createContextualFragment(Locale.translateHTML(propertiesTemplate));

        fragment.querySelector("#property-title-label input").value = properties.title;
        fragment.querySelector("#property-title-address input").value = properties.url;
        const details = document
            .createRange()
            .createContextualFragment(Locale.translateHTML(propertiesDetails));
        details.querySelector("#prop-username").value = properties.username;
        details.querySelector("#prop-password").value = properties.password;
        details.querySelector("#prop-proxy").value = properties.proxyThroughFeedly;

        fragment.insertBefore(details, fragment.querySelector("button"));

        this.el.appendChild(fragment);

        const parentSelect = document.querySelector("#prop-parent");
        folders.forEach((folder) => {
            const option = document.createElement("option");
            option.textContent = folder.get("title");
            option.setAttribute("value", folder.get("id"));
            if (folder.get("id") === this.current.get("folderID")) {
                option.setAttribute("selected", "");
            }
            parentSelect.insertAdjacentElement("beforeend", option);
        });

        document.querySelector("#prop-update-every").value = this.current.get("updateEvery");
        document.querySelector("#prop-autoremove").value = this.current.get("autoremove");
        document.querySelector("#openEnclosure").value = this.current.get("openEnclosure");
        document.querySelector("#defaultView").value = this.current.get("defaultView");
        document.querySelector("#prop-proxy").checked = !!this.current.get("proxyThroughFeedly");
    },
    renderGroup: function () {
        const isFolder = this.current instanceof Folder;
        const listOfSources = isFolder
            ? sources.where({ folderID: this.current.id })
            : this.current;

        const params = {
            updateEveryDiffers: false,
            autoremoveDiffers: false,
            folderIdDiffers: false,
            firstUpdate: listOfSources[0].get("updateEvery"),
            firstAutoremove: listOfSources[0].get("autoremove"),
            firstFolderId: listOfSources[0].get("folderID"),
        };

        const properties = isFolder ? Object.assign(params, this.current.attributes) : params;

        /**
         * Test if all selected feeds has the same properties or if they are mixed
         */
        if (!isFolder) {
            params.updateEveryDiffers = listOfSources.some(function (c) {
                if (params.firstUpdate !== c.get("updateEvery")) {
                    return true;
                }
            });

            params.autoremoveDiffers = listOfSources.some(function (c) {
                if (params.firstAutoremove !== c.get("autoremove")) {
                    return true;
                }
            });

            params.folderIdDiffers = listOfSources.some(function (c) {
                if (params.firstFolderId !== c.get("folderID")) {
                    return true;
                }
            });
        }

        /**
         * Create HTML
         */
        const fragment = document
            .createRange()
            .createContextualFragment(Locale.translateHTML(propertiesTemplate));

        const labelTitle = fragment.querySelector("#property-title-label");
        if (properties.title) {
            labelTitle.querySelector("input").value = properties.title;
        } else {
            fragment.removeChild(labelTitle);
        }
        const labelUrl = fragment.querySelector("#property-title-address");
        if (properties.url) {
            labelUrl.querySelector("input").value = properties.url;
        } else {
            fragment.removeChild(labelUrl);
        }

        const parentSelect = fragment.querySelector("#prop-parent");
        folders.forEach((folder) => {
            const option = document.createElement("option");
            option.textContent = folder.get("title");
            option.setAttribute("value", folder.get("id"));
            parentSelect.insertAdjacentElement("beforeend", option);
        });

        this.el.appendChild(fragment);

        const elementUpdateEvery = document.querySelector("#prop-update-every");
        if (properties.updateEveryDiffers) {
            const option = document
                .createRange()
                .createContextualFragment(`<option value="-2">&lt;mixed&gt;</option>`);
            elementUpdateEvery.prepend(option);
            elementUpdateEvery.value = -2;
        } else {
            elementUpdateEvery.value = params.firstUpdate;
        }

        const elementParent = document.querySelector("#prop-parent");
        if (properties.folderIdDiffers) {
            const option = document
                .createRange()
                .createContextualFragment(`<option value="-2">&lt;mixed&gt;</option>`);
            elementParent.prepend(option);
            elementParent.value = -2;
        } else {
            elementParent.value = params.firstFolderId;
        }

        const elementAutoremove = document.querySelector("#prop-autoremove");
        if (properties.autoremoveDiffers) {
            const option = document
                .createRange()
                .createContextualFragment(`<option value="-2">&lt;mixed&gt;</option>`);
            elementAutoremove.prepend(option);
            elementAutoremove.value = -2;
        } else {
            elementAutoremove.value = params.firstAutoremove;
        }
    },

    render: function () {
        if (!this.current) {
            return;
        }
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }

        if (this.current instanceof Source) {
            this.renderSource();
        } else {
            this.renderGroup();
        }
        return this;
    },
    show: function (source) {
        this.current = source;
        this.render();

        this.el.hidden = false;
    },
    hide: function () {
        this.el.hidden = true;
    },
});
