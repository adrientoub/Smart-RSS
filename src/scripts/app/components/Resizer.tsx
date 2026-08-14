import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type ResizeLayout = "horizontal" | "vertical";

const RESIZE_WIDTH = 6;

interface ResizerProps {
    pane: React.RefObject<HTMLElement | null>;
    layout: ResizeLayout;
    hidden?: boolean;
    /** Called once, with the pane's new size, when the drag ends. */
    onCommit: (size: number) => void;
}

/**
 * The divider between two panes.
 *
 * It is positioned over the pane's trailing edge rather than laid out between
 * the panes, which is what the old `resizable` mixin did with a body-level
 * element. A `ResizeObserver` keeps it aligned instead of the manual
 * recalculation the mixin needed.
 */
export function Resizer({ pane, layout, hidden, onCommit }: ResizerProps) {
    const [box, setBox] = useState({ top: 0, left: 0, width: 0, height: 0 });
    const dragging = useRef(false);

    const reposition = useCallback(() => {
        const element = pane.current;
        if (!element) {
            return;
        }
        const rect = element.getBoundingClientRect();
        const half = Math.round(RESIZE_WIDTH / 2);
        setBox(
            layout === "vertical"
                ? {
                      top: rect.bottom - half,
                      left: rect.left,
                      width: rect.width,
                      height: RESIZE_WIDTH,
                  }
                : {
                      top: rect.top,
                      left: rect.right - half,
                      width: RESIZE_WIDTH,
                      height: rect.height,
                  }
        );
    }, [layout, pane]);

    useLayoutEffect(() => {
        reposition();
        const element = pane.current;
        if (!element) {
            return;
        }
        const observer = new ResizeObserver(reposition);
        observer.observe(element);
        window.addEventListener("resize", reposition);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", reposition);
        };
    }, [pane, reposition]);

    useEffect(() => {
        const move = (event: MouseEvent) => {
            const element = pane.current;
            if (!dragging.current || !element) {
                return;
            }
            event.preventDefault();
            const size =
                layout === "vertical"
                    ? Math.abs(event.clientY - element.offsetTop + 1)
                    : Math.abs(event.clientX - element.offsetLeft + 1);
            element.style.flexBasis = size + "px";
        };
        const up = () => {
            if (!dragging.current) {
                return;
            }
            dragging.current = false;
            document.querySelectorAll("iframe").forEach((frame) => {
                (frame as HTMLElement).style.pointerEvents = "auto";
            });
            const element = pane.current;
            if (element) {
                onCommit(layout === "vertical" ? element.offsetHeight : element.offsetWidth);
            }
        };
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
        return () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
        };
    }, [layout, onCommit, pane]);

    return (
        <div
            className="resizer"
            hidden={hidden}
            style={{
                position: "fixed",
                top: box.top,
                left: box.left,
                width: box.width,
                height: box.height,
                cursor: layout === "vertical" ? "n-resize" : "w-resize",
            }}
            onMouseDown={(event) => {
                event.preventDefault();
                dragging.current = true;
                // The frame would otherwise swallow the mouse events mid-drag.
                document.querySelectorAll("iframe").forEach((frame) => {
                    (frame as HTMLElement).style.pointerEvents = "none";
                });
            }}
        />
    );
}
