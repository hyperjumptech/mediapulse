/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  lookupStalePublisherAuthorityDomains,
  recordPublisherAuthority,
} from "./publisher-authority";

const NOW = new Date("2026-08-10T00:00:00.000Z");

describe("lookupStalePublisherAuthorityDomains", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns nothing when asked for nothing", async () => {
    // Setup
    const findMany = vi.fn();

    // Act
    const stale = await lookupStalePublisherAuthorityDomains(
      [],
      30,
      { findMany, upsert: vi.fn() },
      NOW,
    );

    // Assert
    expect(stale).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("treats a domain with no row as stale", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([]);

    // Act
    const stale = await lookupStalePublisherAuthorityDomains(
      ["detik.com"],
      30,
      { findMany, upsert: vi.fn() },
      NOW,
    );

    // Assert
    expect(stale).toEqual(["detik.com"]);
  });

  it("excludes a domain refreshed inside the ttl", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([{ domain: "detik.com" }]);

    // Act
    const stale = await lookupStalePublisherAuthorityDomains(
      ["detik.com", "kontan.co.id"],
      30,
      { findMany, upsert: vi.fn() },
      NOW,
    );

    // Assert
    expect(stale).toEqual(["kontan.co.id"]);
  });

  it("scopes the freshness window to the requested ttl", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([]);

    // Act
    await lookupStalePublisherAuthorityDomains(
      ["detik.com"],
      30,
      { findMany, upsert: vi.fn() },
      NOW,
    );

    // Assert
    expect(findMany.mock.calls[0]?.[0].where.refreshedAt.gt).toEqual(
      new Date("2026-07-11T00:00:00.000Z"),
    );
  });

  it("deduplicates the requested domains", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([]);

    // Act
    const stale = await lookupStalePublisherAuthorityDomains(
      ["detik.com", "detik.com"],
      30,
      { findMany, upsert: vi.fn() },
      NOW,
    );

    // Assert
    expect(stale).toEqual(["detik.com"]);
  });
});

describe("recordPublisherAuthority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts a scored domain and stamps the refresh time", async () => {
    // Setup
    const upsert = vi.fn().mockResolvedValue({});

    // Act
    const recorded = await recordPublisherAuthority(
      [
        {
          domain: "detik.com",
          openPageRank: 8.03,
          globalRank: 10915,
          referringDomains: 3738,
          asOf: "2026-07-01",
        },
      ],
      { domainAuthority: { findMany: vi.fn(), upsert }, now: NOW },
    );

    // Assert
    expect(recorded).toBe(1);
    expect(upsert.mock.calls[0]?.[0].where).toEqual({ domain: "detik.com" });
    expect(upsert.mock.calls[0]?.[0].update.openPageRank).toBe(8.03);
    expect(upsert.mock.calls[0]?.[0].update.refreshedAt).toEqual(NOW);
  });

  it("stores an unscored domain with a refresh time so it is not re-asked", async () => {
    // Setup
    const upsert = vi.fn().mockResolvedValue({});

    // Act
    await recordPublisherAuthority(
      [
        {
          domain: "ghost.test",
          openPageRank: null,
          globalRank: null,
          referringDomains: null,
          asOf: null,
        },
      ],
      { domainAuthority: { findMany: vi.fn(), upsert }, now: NOW },
    );

    // Assert
    expect(upsert.mock.calls[0]?.[0].update.openPageRank).toBeNull();
    expect(upsert.mock.calls[0]?.[0].update.refreshedAt).toEqual(NOW);
  });

  it("drops an unparsable snapshot date rather than writing an invalid one", async () => {
    // Setup
    const upsert = vi.fn().mockResolvedValue({});

    // Act
    await recordPublisherAuthority(
      [
        {
          domain: "detik.com",
          openPageRank: 8.03,
          globalRank: 1,
          referringDomains: 1,
          asOf: "not-a-date",
        },
      ],
      { domainAuthority: { findMany: vi.fn(), upsert }, now: NOW },
    );

    // Assert
    expect(upsert.mock.calls[0]?.[0].update.asOf).toBeNull();
  });
});
