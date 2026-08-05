import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMessageListener } from "../src/scripts/shared/messages.ts";

describe("createMessageListener", () => {
    it("dispatches to the handler for the action", async () => {
        const seen: unknown[] = [];
        const listen = createMessageListener({
            "new-rss": (request) => {
                seen.push(request);
            },
        });

        await listen({ action: "new-rss", payload: { url: "https://example.com/feed" } });
        assert.deepEqual(seen, [{ url: "https://example.com/feed" }]);
    });

    it("resolves with the handler's return value", async () => {
        // No message declares a response today, so the router's value plumbing
        // is exercised through a stand-in handler.
        const listen = createMessageListener({
            "load-all": (() => "a value") as () => void,
        });

        assert.equal(await listen({ action: "load-all" }), "a value");
    });

    it("awaits an async handler", async () => {
        const listen = createMessageListener({
            "load-all": (async () => ({ layout: "horizontal" })) as unknown as () => Promise<void>,
        });

        assert.deepEqual(await listen({ action: "load-all" }), { layout: "horizontal" });
    });

    // Several contexts listen on the same channel, so answering a message meant
    // for someone else would swallow their response.
    it("returns undefined for an action it does not handle", () => {
        const listen = createMessageListener({ "load-all": () => {} });
        assert.equal(listen({ action: "abort-downloads" }), undefined);
    });

    it("returns undefined for anything that is not an envelope", () => {
        const listen = createMessageListener({ "load-all": () => {} });
        assert.equal(listen(undefined), undefined);
        assert.equal(listen(null), undefined);
        assert.equal(listen("load-all"), undefined);
        assert.equal(listen({}), undefined);
        assert.equal(listen({ action: 42 }), undefined);
    });

    it("propagates a handler rejection rather than swallowing it", async () => {
        const listen = createMessageListener({
            "load-all": () => {
                throw new Error("boom");
            },
        });

        await assert.rejects(() => listen({ action: "load-all" }) as Promise<unknown>, /boom/);
    });

    it("passes undefined to handlers whose request type is void", async () => {
        let called = false;
        const listen = createMessageListener({
            "abort-downloads": (request) => {
                called = true;
                assert.equal(request, undefined);
            },
        });

        await listen({ action: "abort-downloads" });
        assert.ok(called);
    });
});
