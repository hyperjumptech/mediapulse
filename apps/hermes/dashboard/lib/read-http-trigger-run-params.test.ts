/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { readHttpTriggerRunParams } from "./read-http-trigger-run-params";

const jsonRequest = (body: string, contentType = "application/json") =>
  new Request("http://localhost/invoke", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

describe("readHttpTriggerRunParams", () => {
  it("returns the params object from a JSON body", async () => {
    const request = jsonRequest(
      JSON.stringify({ params: { itemId: "abc", limit: 2 } }),
    );

    const result = await readHttpTriggerRunParams(request);

    expect(result).toEqual({
      success: true,
      params: { itemId: "abc", limit: 2 },
    });
  });

  it("leaves the body readable for the request snapshot", async () => {
    const body = JSON.stringify({ params: { itemId: "abc" } });
    const request = jsonRequest(body);

    await readHttpTriggerRunParams(request);

    expect(await request.text()).toBe(body);
  });

  it("accepts +json content types", async () => {
    const request = jsonRequest(
      JSON.stringify({ params: { itemId: "abc" } }),
      "application/vnd.api+json; charset=utf-8",
    );

    const result = await readHttpTriggerRunParams(request);

    expect(result).toEqual({ success: true, params: { itemId: "abc" } });
  });

  it("returns no params when the body has no params key", async () => {
    const request = jsonRequest(JSON.stringify({ other: 1 }));

    const result = await readHttpTriggerRunParams(request);

    expect(result).toEqual({ success: true, params: null });
  });

  it("returns no params for an empty params object", async () => {
    const request = jsonRequest(JSON.stringify({ params: {} }));

    const result = await readHttpTriggerRunParams(request);

    expect(result).toEqual({ success: true, params: null });
  });

  it("ignores non-JSON content types", async () => {
    const request = jsonRequest("params=1", "text/plain");

    const result = await readHttpTriggerRunParams(request);

    expect(result).toEqual({ success: true, params: null });
  });

  it("ignores malformed JSON so the snapshot can record the parse error", async () => {
    const request = jsonRequest("{not json");

    const result = await readHttpTriggerRunParams(request);

    expect(result).toEqual({ success: true, params: null });
  });

  it("returns no params for a request without a body", async () => {
    const request = new Request("http://localhost/invoke", {
      method: "GET",
      headers: { "content-type": "application/json" },
    });

    const result = await readHttpTriggerRunParams(request);

    expect(result).toEqual({ success: true, params: null });
  });

  it("rejects an invalid params shape", async () => {
    const request = jsonRequest(
      JSON.stringify({ params: { itemId: { nested: true } } }),
    );

    const result = await readHttpTriggerRunParams(request);

    expect(result.success).toBe(false);
  });
});
