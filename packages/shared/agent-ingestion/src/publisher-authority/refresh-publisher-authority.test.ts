import { describe, expect, it, vi } from "vitest";

import { refreshPublisherAuthority } from "./refresh-publisher-authority";

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const scoredResponse = (domains: readonly string[]) =>
  jsonResponse({
    as_of: "2026-07-01",
    results: domains.map((domain) => ({
      domain,
      found: true,
      open_page_rank: 7.5,
      rank: 1000,
      referring_domains: 500,
    })),
  });

describe("refreshPublisherAuthority", () => {
  it("does nothing when no domains were persisted", async () => {
    // Setup
    const lookupStale = vi.fn();
    const recordAuthority = vi.fn();

    // Act
    const result = await refreshPublisherAuthority({
      domains: [],
      apiKey: "key",
      ttlDays: 30,
      lookupStale,
      recordAuthority,
    });

    // Assert
    expect(lookupStale).not.toHaveBeenCalled();
    expect(result.requested).toBe(0);
  });

  it("skips enrichment when the api key is blank", async () => {
    // Setup
    const lookupStale = vi.fn();
    const recordAuthority = vi.fn();

    // Act
    const result = await refreshPublisherAuthority({
      domains: ["detik.com"],
      apiKey: "   ",
      ttlDays: 30,
      lookupStale,
      recordAuthority,
    });

    // Assert
    expect(result.skipped).toBe(true);
    expect(lookupStale).not.toHaveBeenCalled();
    expect(recordAuthority).not.toHaveBeenCalled();
  });

  it("asks only for domains the cache reports stale", async () => {
    // Setup
    const lookupStale = vi.fn().mockResolvedValue({ domains: ["detik.com"] });
    const recordAuthority = vi.fn().mockResolvedValue({
      message: "ok",
      recordedCount: 1,
    });
    const fetchImpl = vi.fn().mockResolvedValue(scoredResponse(["detik.com"]));

    // Act
    const result = await refreshPublisherAuthority({
      domains: ["detik.com", "kontan.co.id", "detik.com"],
      apiKey: "key",
      ttlDays: 30,
      lookupStale,
      recordAuthority,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Assert
    expect(lookupStale).toHaveBeenCalledWith({
      domains: ["detik.com", "kontan.co.id"],
      ttlDays: 30,
    });
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body).domains).toEqual([
      "detik.com",
    ]);
    expect(result.scored).toBe(1);
  });

  it("records a null score for a domain the provider omits, so it is not re-asked", async () => {
    // Setup
    const lookupStale = vi.fn().mockResolvedValue({ domains: ["ghost.test"] });
    const recordAuthority = vi.fn().mockResolvedValue({
      message: "ok",
      recordedCount: 1,
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ as_of: "2026-07-01", results: [] }));

    // Act
    const result = await refreshPublisherAuthority({
      domains: ["ghost.test"],
      apiKey: "key",
      ttlDays: 30,
      lookupStale,
      recordAuthority,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Assert
    expect(recordAuthority).toHaveBeenCalledWith([
      {
        domain: "ghost.test",
        openPageRank: null,
        globalRank: null,
        referringDomains: null,
        asOf: null,
      },
    ]);
    expect(result.unscored).toBe(1);
  });

  it("swallows a stale-lookup failure instead of throwing at the caller", async () => {
    // Setup
    const lookupStale = vi.fn().mockRejectedValue(new Error("api down"));
    const recordAuthority = vi.fn();
    const warn = vi.fn();

    // Act
    const result = await refreshPublisherAuthority({
      domains: ["detik.com"],
      apiKey: "key",
      ttlDays: 30,
      lookupStale,
      recordAuthority,
      logger: { info: vi.fn(), warn },
    });

    // Assert
    expect(result.failed).toBe(1);
    expect(warn).toHaveBeenCalled();
    expect(recordAuthority).not.toHaveBeenCalled();
  });

  it("swallows a provider failure instead of throwing at the caller", async () => {
    // Setup
    const lookupStale = vi.fn().mockResolvedValue({ domains: ["detik.com"] });
    const recordAuthority = vi.fn();
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network"));

    // Act
    const result = await refreshPublisherAuthority({
      domains: ["detik.com"],
      apiKey: "key",
      ttlDays: 30,
      lookupStale,
      recordAuthority,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(result.failed).toBe(1);
    expect(result.scored).toBe(0);
  });

  it("splits stale domains into provider-sized batches", async () => {
    // Setup
    const domains = Array.from({ length: 150 }, (_, index) => `d${index}.com`);
    const lookupStale = vi.fn().mockResolvedValue({ domains });
    const recordAuthority = vi.fn().mockResolvedValue({
      message: "ok",
      recordedCount: 0,
    });
    const fetchImpl = vi.fn().mockImplementation((_url, init) => {
      const body = JSON.parse(init.body);

      return Promise.resolve(scoredResponse(body.domains));
    });

    // Act
    const result = await refreshPublisherAuthority({
      domains,
      apiKey: "key",
      ttlDays: 30,
      lookupStale,
      recordAuthority,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Assert
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.scored).toBe(150);
  });
});
