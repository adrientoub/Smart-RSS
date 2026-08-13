import { useEffect, useState } from "react";
import { Icon } from "./Icon.tsx";
import { executeAction } from "../actions.ts";
import { translate } from "../../shared/i18n.ts";

interface Progress {
    loading: boolean;
    loaded: number;
    maxSources: number;
}

/**
 * Feed refresh progress.
 *
 * The port also keeps the background alive while the reader is open, so it is
 * opened even when nothing is downloading.
 */
export function Indicator() {
    const [progress, setProgress] = useState<Progress>({
        loading: false,
        loaded: 0,
        maxSources: 0,
    });

    useEffect(() => {
        const port = browser.runtime.connect({ name: "port-from-cs" });
        port.onMessage.addListener((message: { key: string; value: unknown }) => {
            setProgress((current) => ({ ...current, [message.key]: message.value }));
        });
        return () => port.disconnect();
    }, []);

    const invisible = progress.maxSources === 0 || !progress.loading;
    const percentage = invisible ? 0 : Math.round((progress.loaded * 100) / progress.maxSources);

    return (
        <div
            id="indicator"
            className={invisible ? "indicator-visible indicator-invisible" : "indicator-visible"}
        >
            <div
                id="indicator-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
                style={{ ["--indicator-progress" as string]: percentage + "%" }}
            >
                <span id="indicator-label">
                    {`${translate("UPDATING_FEEDS")} (${progress.loaded}/${progress.maxSources})`}
                </span>
            </div>
            <div id="indicator-toolbar">
                <div id="indicator-stop" onClick={() => executeAction("feeds:stopUpdate")}>
                    <Icon name="stop" className="button-icon" />
                </div>
            </div>
        </div>
    );
}
