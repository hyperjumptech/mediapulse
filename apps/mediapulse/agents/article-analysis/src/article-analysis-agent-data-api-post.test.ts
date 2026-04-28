/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeAnalysisCreateWithTransientRetries,
  isTransientAgentDataApiHttpStatus,
  parseAgentDataApiHttpStatus,
  toArticleAnalysisPostFailureRecord,
} from "./article-analysis-agent-data-api-post.js";

describe("parseAgentDataApiHttpStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns status from agent-data-api client error messages", () => {
    expect(
      parseAgentDataApiHttpStatus(new Error("Agent data API error: 503")),
    ).toBe(503);
  });

  it("returns status when error includes response-body details", () => {
    expect(
      parseAgentDataApiHttpStatus(
        new Error('Agent data API error: 400 - {"error":"bad payload"}'),
      ),
    ).toBe(400);
  });

  it("returns undefined for unrelated errors", () => {
    expect(parseAgentDataApiHttpStatus(new Error("boom"))).toBeUndefined();
    expect(parseAgentDataApiHttpStatus(null)).toBeUndefined();
  });
});

describe("isTransientAgentDataApiHttpStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats 429 and 5xx as transient", () => {
    expect(isTransientAgentDataApiHttpStatus(429)).toBe(true);
    expect(isTransientAgentDataApiHttpStatus(500)).toBe(true);
    expect(isTransientAgentDataApiHttpStatus(503)).toBe(true);
  });

  it("treats missing or 4xx (except 429) as non-transient", () => {
    expect(isTransientAgentDataApiHttpStatus(undefined)).toBe(false);
    expect(isTransientAgentDataApiHttpStatus(400)).toBe(false);
    expect(isTransientAgentDataApiHttpStatus(404)).toBe(false);
  });
});

describe("toArticleAnalysisPostFailureRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies HTTP-shaped errors", () => {
    const rec = toArticleAnalysisPostFailureRecord(
      "entities_relations",
      2,
      new Error("Agent data API error: 502"),
    );
    expect(rec).toMatchObject({
      chunkKind: "entities_relations",
      chunkIndex: 2,
      errorCategory: "agent_data_api_http",
      httpStatus: 502,
      message: "Agent data API error: 502",
    });
  });

  it("classifies unknown errors", () => {
    const rec = toArticleAnalysisPostFailureRecord(
      "article_entities",
      0,
      new Error("network reset"),
    );
    expect(rec).toMatchObject({
      chunkKind: "article_entities",
      chunkIndex: 0,
      errorCategory: "unknown",
      message: "network reset",
    });
    expect(rec).not.toHaveProperty("httpStatus");
  });
});

describe("executeAnalysisCreateWithTransientRetries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the result when the first attempt succeeds", async () => {
    const op = vi.fn().mockResolvedValue("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      executeAnalysisCreateWithTransientRetries(op, {
        maxRetries: 2,
        baseDelayMs: 10,
        sleep,
      }),
    ).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries on transient error then succeeds", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("Agent data API error: 503"))
      .mockResolvedValueOnce("recovered");
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      executeAnalysisCreateWithTransientRetries(op, {
        maxRetries: 2,
        baseDelayMs: 10,
        sleep,
      }),
    ).resolves.toBe("recovered");
    expect(op).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("does not retry non-transient errors", async () => {
    const op = vi
      .fn()
      .mockRejectedValue(new Error("Agent data API error: 400"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      executeAnalysisCreateWithTransientRetries(op, {
        maxRetries: 2,
        baseDelayMs: 10,
        sleep,
      }),
    ).rejects.toThrow("Agent data API error: 400");
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws after exhausting retries", async () => {
    const err = new Error("Agent data API error: 503");
    const op = vi.fn().mockRejectedValue(err);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      executeAnalysisCreateWithTransientRetries(op, {
        maxRetries: 1,
        baseDelayMs: 5,
        sleep,
      }),
    ).rejects.toBe(err);
    expect(op).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(5);
  });
});
