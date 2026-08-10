import { describe, expect, it, vi } from "vitest";

import { fetchOpenPageRank } from "./open-page-rank";

const jsonResponse = (
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("fetchOpenPageRank", () => {
  it("suppresses history so a full batch stays small", async () => {
    // Setup
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ as_of: "2026-07-01", results: [] }));

    // Act
    await fetchOpenPageRank({
      apiKey: "key",
      domains: ["detik.com"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Assert
    const requestBody = JSON.parse(fetchImpl.mock.calls[0]?.[1].body);

    expect(requestBody.include_history).toBe(false);
    expect(requestBody.domains).toEqual(["detik.com"]);
  });

  it("sends the api key as a bearer token", async () => {
    // Setup
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ as_of: "2026-07-01", results: [] }));

    // Act
    await fetchOpenPageRank({
      apiKey: "secret",
      domains: ["detik.com"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Assert
    expect(fetchImpl.mock.calls[0]?.[1].headers.Authorization).toBe(
      "Bearer secret",
    );
  });

  it("maps a scored domain and stamps the response snapshot date", async () => {
    // Setup
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        as_of: "2026-07-01",
        results: [
          {
            domain: "detik.com",
            found: true,
            open_page_rank: 8.03,
            rank: 10915,
            referring_domains: 3738,
          },
        ],
      }),
    );

    // Act
    const batch = await fetchOpenPageRank({
      apiKey: "key",
      domains: ["detik.com"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Assert
    expect(batch.scores).toEqual([
      {
        domain: "detik.com",
        openPageRank: 8.03,
        globalRank: 10915,
        referringDomains: 3738,
        asOf: "2026-07-01",
      },
    ]);
  });

  it("nulls every field for a domain the provider has no score for", async () => {
    // Setup
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        as_of: "2026-07-01",
        results: [
          {
            domain: "zzz-not-a-real-domain-xyz9.com",
            found: false,
            open_page_rank: null,
            rank: null,
            referring_domains: null,
          },
        ],
      }),
    );

    // Act
    const batch = await fetchOpenPageRank({
      apiKey: "key",
      domains: ["zzz-not-a-real-domain-xyz9.com"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Assert
    expect(batch.scores[0]?.openPageRank).toBeNull();
    expect(batch.scores[0]?.globalRank).toBeNull();
  });

  it("reads the remaining monthly domain quota from the response headers", async () => {
    // Setup
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { as_of: "2026-07-01", results: [] },
          { "X-Domains-Remaining": "29987" },
        ),
      );

    // Act
    const batch = await fetchOpenPageRank({
      apiKey: "key",
      domains: ["detik.com"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Assert
    expect(batch.domainsRemaining).toBe(29987);
  });

  it("refuses a batch larger than the provider accepts", async () => {
    // Setup
    const fetchImpl = vi.fn();
    const domains = Array.from({ length: 101 }, (_, index) => `d${index}.com`);

    // Act / Assert
    await expect(
      fetchOpenPageRank({
        apiKey: "key",
        domains,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/at most 100 domains/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws on a non-ok response", async () => {
    // Setup
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 429 }));

    // Act / Assert
    await expect(
      fetchOpenPageRank({
        apiKey: "key",
        domains: ["detik.com"],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/status 429/);
  });
});
