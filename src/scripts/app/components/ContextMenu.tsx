import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon.tsx";
import { contextMenus } from "../staticdb/contextMenus.ts";
import { uiStore } from "../state/uiState.ts";
import { useStoreState } from "../state/hooks.ts";

export function ContextMenu() {
    const state = useStoreState(uiStore, (value) => value.contextMenu);
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: 0, top: 0 });

    useLayoutEffect(() => {
        const element = ref.current;
        if (!state || !element) {
            return;
        }
        let { x, y } = state;
        if (x + element.offsetWidth + 4 > document.body.offsetWidth) {
            x = document.body.offsetWidth - element.offsetWidth - 8;
        }
        if (y + element.offsetHeight + 4 > document.body.offsetHeight) {
            y = document.body.offsetHeight - element.offsetHeight - 8;
        }
        setPosition({ left: x, top: y });
    }, [state]);

    useEffect(() => {
        if (!state) {
            return;
        }
        const close = () => uiStore.setState({ contextMenu: null });
        window.addEventListener("blur", close);
        return () => window.removeEventListener("blur", close);
    }, [state]);

    if (!state) {
        return null;
    }
    const definition = contextMenus[state.menu];
    if (!definition) {
        return null;
    }

    return (
        <div
            ref={ref}
            className="context-menu"
            style={{ position: "fixed", left: position.left, top: position.top }}
        >
            {definition
                .filter((item) => !item.hidden?.())
                .map((item, index) => (
                    <div
                        key={item.id ?? index}
                        id={item.id}
                        className="context-menu-item"
                        onClick={(event) => {
                            item.action(event.nativeEvent);
                            uiStore.setState({ contextMenu: null });
                        }}
                    >
                        {item.icon ? (
                            <Icon name={item.icon} className="context-menu-icon" />
                        ) : (
                            <span className="context-menu-icon" />
                        )}
                        <span className="context-menu-label">
                            {typeof item.title === "function" ? item.title() : item.title}
                        </span>
                    </div>
                ))}
        </div>
    );
}
