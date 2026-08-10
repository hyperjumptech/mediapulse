import { APICallError } from "ai";
import { describe, expect, it } from "vitest";

import { describeLlmError } from "./describe-llm-error.js";

describe("describeLlmError", () => {
  it("keeps the provider fields needed to diagnose a failure", () => {
    const error = new APICallError({
      message: "Bad request: unsupported response_format",
      url: "https://api.openai.com/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
      responseHeaders: { "x-request-id": "req_abc123" },
      responseBody: '{"error":{"code":"invalid_request_error"}}',
    });
    const details = describeLlmError(error);

    expect(details.kind).toBe("APICallError");
    expect(details.statusCode).toBe(400);
    expect(details.isRetryable).toBe(false);
    expect(details.requestId).toBe("req_abc123");
    expect(details.responseBody).toContain("invalid_request_error");
  });

  it("redacts a key echoed back in the message", () => {
    const details = describeLlmError(
      new Error("Incorrect API key provided: sk-abc123XYZ"),
    );

    expect(details.message).not.toContain("sk-abc123XYZ");
    expect(details.message).toContain("[REDACTED]");
  });

  it("truncates an oversized response body", () => {
    const error = new APICallError({
      message: "boom",
      url: "https://api.openai.com/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 500,
      isRetryable: true,
      responseBody: "x".repeat(5000),
    });

    expect(describeLlmError(error).responseBody?.length).toBeLessThanOrEqual(
      603,
    );
  });

  it("describes a plain error", () => {
    const details = describeLlmError(new Error("socket hang up"));

    expect(details.kind).toBe("Error");
    expect(details.message).toBe("socket hang up");
    expect(details.statusCode).toBeUndefined();
  });

  it("describes a non-error throw", () => {
    expect(describeLlmError("nope").message).toBe("nope");
  });
});
