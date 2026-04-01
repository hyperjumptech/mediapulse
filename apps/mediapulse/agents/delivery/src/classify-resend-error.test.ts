import { describe, expect, it } from "vitest";

import {
  classifyResendApiError,
  classifyResendError,
  extractResendResponseParts,
  retryAfterMsFromError,
  retryAfterMsFromHeaders,
} from "./classify-resend-error.js";

describe("classifyResendApiError", () => {
  it("classifies rate_limit_exceeded and 429", () => {
    expect(
      classifyResendApiError({
        message: "x",
        statusCode: null,
        name: "rate_limit_exceeded",
      }),
    ).toBe("rate_limited");
    expect(
      classifyResendApiError({
        message: "x",
        statusCode: 429,
        name: "validation_error",
      }),
    ).toBe("rate_limited");
  });

  it("classifies server errors as transient", () => {
    expect(
      classifyResendApiError({
        message: "x",
        statusCode: 503,
        name: "validation_error",
      }),
    ).toBe("transient");
    expect(
      classifyResendApiError({
        message: "x",
        statusCode: null,
        name: "internal_server_error",
      }),
    ).toBe("transient");
  });
});

describe("classifyResendError", () => {
  it("classifies rate limit", () => {
    expect(classifyResendError(new Error("429 too many"))).toBe("rate_limited");
    expect(classifyResendError(new Error("Rate limit exceeded"))).toBe(
      "rate_limited",
    );
  });

  it("classifies transient network/server", () => {
    expect(classifyResendError(new Error("fetch failed"))).toBe("transient");
    expect(classifyResendError(new Error("503"))).toBe("transient");
  });

  it("classifies other as non-retryable", () => {
    expect(classifyResendError(new Error("invalid email"))).toBe(
      "non_retryable",
    );
  });

  it("prefers attached Resend API error", () => {
    const err = new Error("boom");
    Object.assign(err, {
      resendError: {
        message: "quota",
        statusCode: null,
        name: "rate_limit_exceeded",
      },
    });
    expect(classifyResendError(err)).toBe("rate_limited");
  });
});

describe("retryAfterMsFromHeaders", () => {
  it("parses retry-after seconds", () => {
    expect(retryAfterMsFromHeaders({ "retry-after": "2" })).toBe(2000);
    expect(retryAfterMsFromHeaders({ "Retry-After": "5" })).toBe(5000);
  });

  it("returns undefined when absent", () => {
    expect(retryAfterMsFromHeaders({})).toBeUndefined();
    expect(retryAfterMsFromHeaders(null)).toBeUndefined();
  });
});

describe("retryAfterMsFromError", () => {
  it("returns ms when retry-after seconds found in message", () => {
    expect(retryAfterMsFromError(new Error("Retry-After: 3"))).toBe(3000);
  });

  it("reads retry-after from attached headers", () => {
    const err = new Error("x");
    Object.assign(err, {
      resendError: {
        message: "m",
        statusCode: 429,
        name: "rate_limit_exceeded",
      },
      resendHeaders: { "retry-after": "4" },
    });
    expect(retryAfterMsFromError(err)).toBe(4000);
  });

  it("returns undefined when absent", () => {
    expect(retryAfterMsFromError(new Error("nope"))).toBeUndefined();
  });
});

describe("extractResendResponseParts", () => {
  it("returns api and headers when present", () => {
    const err = new Error("e");
    Object.assign(err, {
      resendError: {
        message: "m",
        statusCode: 400,
        name: "validation_error",
      },
      resendHeaders: { "retry-after": "1" },
    });
    const parts = extractResendResponseParts(err);
    expect(parts.api?.name).toBe("validation_error");
    expect(parts.headers?.["retry-after"]).toBe("1");
  });
});
