/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import { DATA_COLLECTION_EXISTING_URLS_MAX } from "@workspace/agent-data-api-contract";

import {
  resolveExistingDataSourceUrls,
  type LookupExistingDataSourceUrls,
} from "./resolve-existing-data-source-urls";

describe("resolveExistingDataSourceUrls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty set and host counts when there are no candidate URLs", async () => {
    const lookup = vi.fn().mockResolvedValue({
      existingUrls: [],
      hostCounts: { "example.com": 2 },
    });

    const result = await resolveExistingDataSourceUrls(
      "ticker-1",
      [],
      lookup as LookupExistingDataSourceUrls,
    );

    expect(result.existingUrls.size).toBe(0);
    expect(result.hostCounts).toEqual({ "example.com": 2 });
    expect(lookup).toHaveBeenCalledWith({ tickerId: "ticker-1", urls: [] });
  });

  it("merges existing URLs from a single lookup chunk", async () => {
    const lookup = vi.fn().mockResolvedValue({
      existingUrls: ["https://a.example", "https://b.example"],
      hostCounts: { "a.example": 1 },
    });

    const result = await resolveExistingDataSourceUrls(
      "ticker-1",
      ["https://a.example", "https://c.example", "https://a.example"],
      lookup as LookupExistingDataSourceUrls,
    );

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith({
      tickerId: "ticker-1",
      urls: ["https://a.example", "https://c.example"],
    });
    expect(result.existingUrls.has("https://a.example")).toBe(true);
    expect(result.existingUrls.has("https://b.example")).toBe(true);
    expect(result.existingUrls.has("https://c.example")).toBe(false);
    expect(result.hostCounts).toEqual({ "a.example": 1 });
  });

  it("chunks requests when candidate count exceeds max", async () => {
    const urls = Array.from(
      { length: DATA_COLLECTION_EXISTING_URLS_MAX + 1 },
      (_, index) => `https://example.com/p/${index}`,
    );
    const lookup = vi.fn().mockResolvedValue({
      existingUrls: [],
      hostCounts: {},
    });

    await resolveExistingDataSourceUrls(
      "ticker-1",
      urls,
      lookup as LookupExistingDataSourceUrls,
    );

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls[0]?.[0].urls).toHaveLength(
      DATA_COLLECTION_EXISTING_URLS_MAX,
    );
    expect(lookup.mock.calls[1]?.[0].urls).toHaveLength(1);
  });
});
