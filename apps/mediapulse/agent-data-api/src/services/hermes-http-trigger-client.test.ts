/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createHermesHttpTriggerClient } from "./hermes-http-trigger-client.js";

const invokeArgs = {
  triggerId: "trigger-1",
  token: "secret-token",
  params: { tickerId: "ticker-1" },
  requestId: "day1:ut-1:dispatch-1",
};

describe("createHermesHttpTriggerClient", () => {
  it("posts the params to the trigger invoke URL and returns the execution id", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "accepted", executionId: "e-1" }), {
        status: 202,
      }),
    );
    const invoke = createHermesHttpTriggerClient({
      baseUrl: "https://hermes.example/",
      timeoutMs: 5_000,
      fetchImpl,
    });

    const result = await invoke(invokeArgs);

    expect(result).toEqual({ executionId: "e-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://hermes.example/api/http-triggers/trigger-1/invoke",
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      authorization: "Bearer secret-token",
      "content-type": "application/json",
      "x-request-id": "day1:ut-1:dispatch-1",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      params: { tickerId: "ticker-1" },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws with the status and body when Hermes does not accept the call", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"error":"Unauthorized"}', { status: 401 }),
      );
    const invoke = createHermesHttpTriggerClient({
      baseUrl: "https://hermes.example",
      timeoutMs: 5_000,
      fetchImpl,
    });

    await expect(invoke(invokeArgs)).rejects.toThrow(
      'Hermes trigger trigger-1 answered 401: {"error":"Unauthorized"}',
    );
  });

  it("returns a null execution id when the accepted response has no body", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 202 }));
    const invoke = createHermesHttpTriggerClient({
      baseUrl: "https://hermes.example",
      timeoutMs: 5_000,
      fetchImpl,
    });

    await expect(invoke(invokeArgs)).resolves.toEqual({ executionId: null });
  });

  it("propagates a network failure", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("socket hang up"));
    const invoke = createHermesHttpTriggerClient({
      baseUrl: "https://hermes.example",
      timeoutMs: 5_000,
      fetchImpl,
    });

    await expect(invoke(invokeArgs)).rejects.toThrow("socket hang up");
  });
});
