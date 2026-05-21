/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import {
  computeDeadUrlExpiresAt,
  isDeadUrlCacheable,
} from "@workspace/agent-data-api-contract";

import { lookupDeadUrls, recordDeadUrls } from "./data-collection-dead-url";

describe("lookupDeadUrls", () => {
  it("returns active dead URLs for the ticker", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { url: "https://example.com/a" },
        { url: "https://example.com/b" },
      ]);

    const result = await lookupDeadUrls(
      "ticker-1",
      ["https://example.com/a", "https://example.com/c"],
      { findMany, upsert: vi.fn() },
      now,
    );

    expect(result).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        url: { in: ["https://example.com/a", "https://example.com/c"] },
        expiresAt: { gt: now },
      },
      select: { url: true },
    });
  });
});

describe("recordDeadUrls", () => {
  it("upserts cacheable records and skips non-cacheable HTTP statuses", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const upsert = vi.fn().mockResolvedValue({});

    const recordedCount = await recordDeadUrls(
      [
        {
          tickerId: "ticker-1",
          url: "https://example.com/missing",
          errorCategory: "provider_http_error",
          httpStatus: 404,
        },
        {
          tickerId: "ticker-1",
          url: "https://example.com/server-error",
          errorCategory: "provider_http_error",
          httpStatus: 500,
        },
        {
          tickerId: "ticker-1",
          url: "https://example.com/empty",
          errorCategory: "content_too_short",
        },
      ],
      { deadUrl: { findMany: vi.fn(), upsert }, now },
    );

    expect(recordedCount).toBe(2);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith({
      where: { url: "https://example.com/missing" },
      create: expect.objectContaining({
        tickerId: "ticker-1",
        errorCategory: "provider_http_error",
        expiresAt: computeDeadUrlExpiresAt("provider_http_error", 404, now),
      }),
      update: expect.objectContaining({
        expiresAt: computeDeadUrlExpiresAt("provider_http_error", 404, now),
      }),
    });
  });
});

describe("isDeadUrlCacheable", () => {
  it("accepts terminal HTTP statuses and quality categories", () => {
    expect(isDeadUrlCacheable("provider_http_error", 404)).toBe(true);
    expect(isDeadUrlCacheable("provider_http_error", 403)).toBe(true);
    expect(isDeadUrlCacheable("provider_http_error", 500)).toBe(false);
    expect(isDeadUrlCacheable("provider_data_invalid")).toBe(true);
    expect(isDeadUrlCacheable("content_too_short")).toBe(true);
    expect(isDeadUrlCacheable("timeout_error")).toBe(false);
  });
});
