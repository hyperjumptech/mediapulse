/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HTTP_TRIGGER_REQUEST_HEADER_REDACTED,
  buildRequestBodySnapshot,
  collectHttpTriggerRequestSnapshot,
  collectRedactedHeaderRecord,
  DEFAULT_HTTP_TRIGGER_REQUEST_BODY_MAX_BYTES,
  isSensitiveHttpHeaderName,
  searchParamsToRecord,
  shouldOmitBodyForContentType,
  toHttpTriggerExecutionMetadata,
  truncateUtf8String,
} from "./collect-http-trigger-request-snapshot";

describe("isSensitiveHttpHeaderName", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true for authorization", () => {
    // Act
    const a = isSensitiveHttpHeaderName("Authorization");
    const b = isSensitiveHttpHeaderName("authorization");

    // Assert
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it("returns true for cookie and proxy-authorization", () => {
    // Act & Assert
    expect(isSensitiveHttpHeaderName("Cookie")).toBe(true);
    expect(isSensitiveHttpHeaderName("Set-Cookie")).toBe(true);
    expect(isSensitiveHttpHeaderName("Proxy-Authorization")).toBe(true);
  });

  it("returns true for api key style headers", () => {
    // Act & Assert
    expect(isSensitiveHttpHeaderName("X-Api-Key")).toBe(true);
    expect(isSensitiveHttpHeaderName("x-auth-token")).toBe(true);
  });

  it("returns false for safe headers", () => {
    // Act & Assert
    expect(isSensitiveHttpHeaderName("Accept")).toBe(false);
    expect(isSensitiveHttpHeaderName("Content-Type")).toBe(false);
  });
});

describe("searchParamsToRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps single values to strings", () => {
    // Setup
    const params = new URLSearchParams("a=1&b=two");

    // Act
    const rec = searchParamsToRecord(params);

    // Assert
    expect(rec).toEqual({ a: "1", b: "two" });
  });

  it("maps duplicate keys to string arrays", () => {
    // Setup
    const params = new URLSearchParams("a=1&a=2");

    // Act
    const rec = searchParamsToRecord(params);

    // Assert
    expect(rec).toEqual({ a: ["1", "2"] });
  });
});

describe("shouldOmitBodyForContentType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false for null and text types", () => {
    // Act & Assert
    expect(shouldOmitBodyForContentType(null)).toBe(false);
    expect(shouldOmitBodyForContentType("")).toBe(false);
    expect(shouldOmitBodyForContentType("application/json")).toBe(false);
    expect(shouldOmitBodyForContentType("text/plain; charset=utf-8")).toBe(
      false,
    );
  });

  it("returns true for multipart and octet-stream", () => {
    // Act & Assert
    expect(
      shouldOmitBodyForContentType("multipart/form-data; boundary=x"),
    ).toBe(true);
    expect(shouldOmitBodyForContentType("application/octet-stream")).toBe(true);
  });

  it("returns true for image video audio", () => {
    // Act & Assert
    expect(shouldOmitBodyForContentType("image/png")).toBe(true);
    expect(shouldOmitBodyForContentType("video/mp4")).toBe(true);
    expect(shouldOmitBodyForContentType("audio/wav")).toBe(true);
  });
});

describe("truncateUtf8String", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unchanged when under byte limit", () => {
    // Act
    const r = truncateUtf8String("hello", 100);

    // Assert
    expect(r.text).toBe("hello");
    expect(r.truncated).toBe(false);
    expect(r.originalByteLength).toBe(5);
  });

  it("truncates to max bytes without splitting codepoints", () => {
    // Setup — euro is 3 UTF-8 bytes
    const input = "a€b";

    // Act
    const r = truncateUtf8String(input, 2);

    // Assert
    expect(r.truncated).toBe(true);
    expect(r.originalByteLength).toBeGreaterThan(2);
    expect(r.text).toBe("a");
  });
});

describe("collectRedactedHeaderRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts authorization and keeps other headers", () => {
    // Setup
    const headers = new Headers();
    headers.set("Authorization", "Bearer secret");
    headers.set("X-Custom", "ok");

    // Act
    const rec = collectRedactedHeaderRecord(headers);

    // Assert
    expect(rec.authorization).toBe(HTTP_TRIGGER_REQUEST_HEADER_REDACTED);
    expect(rec["x-custom"]).toBe("ok");
  });
});

describe("buildRequestBodySnapshot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits body for multipart content type", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=abc" },
      body: "ignored",
    });

    // Act
    const body = await buildRequestBodySnapshot(
      request,
      "multipart/form-data; boundary=abc",
      1024,
    );

    // Assert
    expect(body.omittedReason).toBe("non_text_or_large_binary_content_type");
    expect(body.contentType).toBe("multipart/form-data; boundary=abc");
  });

  it("returns parseError for invalid JSON when type is application/json", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    // Act
    const body = await buildRequestBodySnapshot(
      request,
      "application/json",
      1024,
    );

    // Assert
    expect(body.parseError).toBeDefined();
    expect(body.text).toContain("{not-json");
  });

  it("masks secrets in parsed JSON body", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", apiKey: "secret" }),
    });

    // Act
    const body = await buildRequestBodySnapshot(
      request,
      "application/json",
      1024,
    );

    // Assert
    expect(body.json).toEqual({
      name: "x",
      apiKey: expect.any(String),
    });
    expect((body.json as { apiKey: string }).apiKey).not.toBe("secret");
  });

  it("stores plain text body for text/plain", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    });

    // Act
    const body = await buildRequestBodySnapshot(request, "text/plain", 1024);

    // Assert
    expect(body.text).toBe("hello");
    expect(body.truncated).toBe(false);
  });

  it("truncates body when over maxBodyBytes", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "abcdefghij",
    });

    // Act
    const body = await buildRequestBodySnapshot(request, "text/plain", 4);

    // Assert
    expect(body.truncated).toBe(true);
    expect(body.text).toBe("abcd");
    expect(body.originalByteLength).toBe(10);
  });

  it("returns omittedReason when body read throws", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "x",
    });
    vi.spyOn(request, "text").mockRejectedValue(new Error("boom"));

    // Act
    const body = await buildRequestBodySnapshot(request, "text/plain", 1024);

    // Assert
    expect(body.omittedReason).toBe("body_read_failed");
  });

  it("parses application/vnd.api+json as JSON", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/vnd.api+json" },
      body: '{"a":1}',
    });

    // Act
    const body = await buildRequestBodySnapshot(
      request,
      "application/vnd.api+json",
      1024,
    );

    // Assert
    expect(body.json).toEqual({ a: 1 });
  });

  it("returns empty text for application/json with empty body", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });

    // Act
    const body = await buildRequestBodySnapshot(
      request,
      "application/json",
      1024,
    );

    // Assert
    expect(body.text).toBe("");
    expect(body.truncated).toBe(false);
    expect(body.originalByteLength).toBe(0);
  });
});

describe("collectHttpTriggerRequestSnapshot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("collects url method search params headers client and body", async () => {
    // Setup
    const request = new Request(
      "http://example.com/api/http-triggers/t1/invoke?q=1&q=2",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer x",
          "User-Agent": "vitest",
          "X-Forwarded-For": "203.0.113.1",
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );

    // Act
    const snap = await collectHttpTriggerRequestSnapshot(request);

    // Assert
    expect(snap.requestSnapshotVersion).toBe(1);
    expect(snap.request.method).toBe("POST");
    expect(snap.request.pathname).toBe("/api/http-triggers/t1/invoke");
    expect(snap.request.searchParams).toEqual({ q: ["1", "2"] });
    expect(snap.headers.authorization).toBe(
      HTTP_TRIGGER_REQUEST_HEADER_REDACTED,
    );
    expect(snap.client.userAgent).toBe("vitest");
    expect(snap.client.forwardedFor).toBe("203.0.113.1");
    expect(snap.body.json).toEqual({});
  });

  it("respects maxBodyBytes option", async () => {
    // Setup
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "abcdef",
    });

    // Act
    const snap = await collectHttpTriggerRequestSnapshot(request, {
      maxBodyBytes: 3,
    });

    // Assert
    expect(snap.body.truncated).toBe(true);
    expect(snap.body.text).toBe("abc");
  });

  it("uses default max body bytes from constant", async () => {
    // Setup
    const longBody = "x".repeat(
      DEFAULT_HTTP_TRIGGER_REQUEST_BODY_MAX_BYTES + 1,
    );
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: longBody,
    });

    // Act
    const snap = await collectHttpTriggerRequestSnapshot(request);

    // Assert
    expect(snap.body.truncated).toBe(true);
    expect(snap.body.originalByteLength).toBe(
      DEFAULT_HTTP_TRIGGER_REQUEST_BODY_MAX_BYTES + 1,
    );
  });
});

describe("toHttpTriggerExecutionMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes snapshot fields for Prisma Json", () => {
    // Setup
    const snapshot = {
      requestSnapshotVersion: 1 as const,
      request: {
        method: "GET",
        url: "http://x",
        pathname: "/",
        searchParams: {},
      },
      headers: {},
      body: { contentType: null },
      client: {
        userAgent: null,
        forwardedFor: null,
        realIp: null,
        cfConnectingIp: null,
      },
    };

    // Act
    const meta = toHttpTriggerExecutionMetadata(snapshot);

    // Assert
    expect(meta.requestSnapshotVersion).toBe(1);
    expect(meta.request).toEqual(snapshot.request);
    expect(meta.headers).toEqual({});
    expect(meta.body).toEqual({ contentType: null });
    expect(meta.client).toEqual(snapshot.client);
  });
});
