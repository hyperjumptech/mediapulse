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

  it("returns empty set when there are no candidate URLs", async () => {
    const lookup = vi.fn();

    const result = await resolveExistingDataSourceUrls(
      "ticker-1",
      [],
      lookup as LookupExistingDataSourceUrls,
    );

    expect(result.size).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("merges existing URLs from a single lookup chunk", async () => {
    const lookup = vi.fn().mockResolvedValue({
      existingUrls: ["https://a.example", "https://b.example"],
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
    expect(result.has("https://a.example")).toBe(true);
    expect(result.has("https://b.example")).toBe(true);
    expect(result.has("https://c.example")).toBe(false);
  });

  it("chunks requests when candidate count exceeds max", async () => {
    const urls = Array.from(
      { length: DATA_COLLECTION_EXISTING_URLS_MAX + 1 },
      (_, i) => `https://example.com/p/${i}`,
    );
    const lookup = vi.fn().mockResolvedValue({
      existingUrls: [],
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
