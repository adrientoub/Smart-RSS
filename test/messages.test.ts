import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    createMessageListener,
    isNoReceiverError,
    NoReceiverError,
    retryWhileNoReceiver,
} from "../src/scripts/shared/messages.ts";

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

describe("retryWhileNoReceiver", () => {
    const noReceiver = () =>
        Promise.reject(new Error("Could not establish connection. Receiving end does not exist."));

    it("returns the first successful value without waiting", async () => {
        const slept: number[] = [];
        const value = await retryWhileNoReceiver(async () => "up", {
            sleep: async (ms) => {
                slept.push(ms);
            },
        });

        assert.equal(value, "up");
        assert.deepEqual(slept, []);
    });

    // The background page may not have registered its listener yet when a
    // restored tab sends its first message.
    it("retries with a growing delay until someone listens", async () => {
        const slept: number[] = [];
        let attempts = 0;
        const value = await retryWhileNoReceiver(
            () => {
                attempts += 1;
                return attempts < 4 ? noReceiver() : Promise.resolve("up");
            },
            {
                sleep: async (ms) => {
                    slept.push(ms);
                },
            }
        );

        assert.equal(value, "up");
        assert.deepEqual(slept, [50, 100, 200]);
    });

    it("rethrows anything that is not a missing receiver", async () => {
        let attempts = 0;
        await assert.rejects(
            () =>
                retryWhileNoReceiver(
                    () => {
                        attempts += 1;
                        return Promise.reject(new Error("boom"));
                    },
                    { sleep: async () => {} }
                ),
            /boom/
        );
        assert.equal(attempts, 1);
    });

    it("gives up once the timeout has passed", async () => {
        let clock = 0;
        await assert.rejects(
            () =>
                retryWhileNoReceiver(noReceiver, {
                    timeoutMs: 100,
                    now: () => clock,
                    sleep: async (ms) => {
                        clock += ms;
                    },
                }),
            /Receiving end does not exist/
        );
    });
});

describe("isNoReceiverError", () => {
    it("recognises both runtimes' wording", () => {
        assert.ok(isNoReceiverError(new Error("Could not establish connection.")));
        assert.ok(isNoReceiverError(new Error("Receiving end does not exist.")));
        assert.ok(isNoReceiverError(new NoReceiverError("not answered yet")));
    });

    it("does not swallow other failures", () => {
        assert.equal(isNoReceiverError(new Error("Message length exceeded")), false);
        assert.equal(isNoReceiverError(undefined), false);
    });
});
