import { Icon } from "./Icon.tsx";
import { actionIcon, actionTitle, executeAction, getAction } from "../actions.ts";
import type { ToolbarItem } from "../staticdb/toolbarItems.ts";
import { settings, useSettingsVersion, useStoreState } from "../state/hooks.ts";
import { countsStore } from "../state/data.ts";
import { uiStore } from "../state/uiState.ts";
import { translate } from "../../shared/i18n.ts";
import { contentArticle } from "../state/selectors.ts";

interface ToolbarProps {
    items: readonly ToolbarItem[];
}

/** Items that only make sense for trashed articles. */
function isHidden(item: ToolbarItem, queryName: string | null, trashed: boolean): boolean {
    if (item === "articles:undelete") {
        return queryName !== "trash";
    }
    if (item === "content:undelete") {
        return !trashed;
    }
    if (item === "articles:delete" || item === "content:delete") {
        return false;
    }
    return false;
}

export function Toolbar({ items }: ToolbarProps) {
    useSettingsVersion();
    const query = useStoreState(uiStore, (state) => state.query);
    const search = useStoreState(uiStore, (state) => state.search);
    const contentId = useStoreState(uiStore, (state) => state.contentId);
    const counts = useStoreState(countsStore, (state) => state.counts);
    const trashed = Boolean(contentId && contentArticle()?.trashed);

    return (
        <div className="toolbar">
            {items.map((item, index) => {
                if (item === "!dynamicSpace") {
                    return <div className="dynamic-space" key={`space-${index}`} />;
                }

                const action = getAction(item);
                if (!action) {
                    return null;
                }
                const hidden = isHidden(item, query.name, trashed);

                if (item === "articles:search") {
                    return (
                        <input
                            key={item}
                            className="input-search"
                            type="search"
                            tabIndex={-1}
                            placeholder={translate("SEARCH")}
                            data-action={item}
                            title={actionTitle(item)}
                            value={search}
                            hidden={hidden}
                            onChange={(event) => uiStore.setState({ search: event.target.value })}
                        />
                    );
                }

                const active = Boolean(action.state && settings.get(action.state));
                return (
                    <div
                        key={item}
                        className={active ? "button active" : "button"}
                        data-action={item}
                        title={actionTitle(item)}
                        hidden={hidden}
                        // A button is not focusable, so clicking one would
                        // otherwise move focus off the row and out of the region
                        // the hotkey table is keyed on.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => executeAction(item, event)}
                    >
                        <Icon name={actionIcon(item)} className="button-icon" />
                        {item === "articles:toggleShowOnlyUnread" ? (
                            <span className="toolbar-unread-count">
                                {counts.counters.allCountUnread}
                            </span>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}
