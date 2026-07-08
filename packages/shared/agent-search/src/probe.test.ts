import type got from "got";
import { describe, expect, it } from "vitest";

import { RoundRobinCursor } from "./dispatch";
import { countQueryHits, type CreditsSink } from "./probe";
import type { SearchProvider, SearchProviderResult } from "./types";

const fakeGot = {} as unknown as typeof got;

const makeProvider = (
  type: string,
  respond: () => Promise<SearchProviderResult>,
): SearchProvider =>
  ({
    type: type as SearchProvider["type"],
    search: () => respond(),
  }) as SearchProvider;

const hitsResult = (count: number, credits?: number): SearchProviderResult => ({
  hits: Array.from({ length: count }, (_unused, index) => ({
    url: `https://example.test/${String(index)}`,
    title: "t",
    snippet: "s",
  })),
  ...(credits !== undefined ? { credits } : {}),
});

describe("countQueryHits", () => {
  it("returns the hit count and provider for a yielding query", async () => {
    const providers = [
      makeProvider("serper", () => Promise.resolve(hitsResult(3))),
    ];
    const result = await countQueryHits("kopi kenangan", {
      providers,
      locales: [{ gl: "id", hl: "id" }],
      cursor: new RoundRobinCursor(),
      gotClient: fakeGot,
    });

    expect(result.hits).toBe(3);
    expect(result.provider).toBe("serper");
  });

  it("accumulates provider-reported credits into the result and the sink", async () => {
    const creditsSink: CreditsSink = { credits: 0 };
    const providers = [
      makeProvider("serper", () => Promise.resolve(hitsResult(2, 5))),
    ];
    const result = await countQueryHits("bpom label gizi", {
      providers,
      locales: [
        { gl: "id", hl: "id" },
        { gl: "us", hl: "en" },
      ],
      cursor: new RoundRobinCursor(),
      gotClient: fakeGot,
      creditsSink,
    });

    // One call per locale, each reporting 5 credits.
    expect(result.credits).toBe(10);
    expect(creditsSink.credits).toBe(10);
    expect(result.hits).toBe(2);
  });

  it("keeps the max hit count across locales", async () => {
    let call = 0;
    const providers = [
      makeProvider("serper", () => {
        call += 1;

        return Promise.resolve(hitsResult(call === 1 ? 1 : 7));
      }),
    ];
    const result = await countQueryHits("fore coffee", {
      providers,
      locales: [
        { gl: "id", hl: "id" },
        { gl: "us", hl: "en" },
      ],
      cursor: new RoundRobinCursor(),
      gotClient: fakeGot,
    });

    expect(result.hits).toBe(7);
  });

  it("treats a fully failed provider pool as zero hits", async () => {
    const providers = [
      makeProvider("serper", () => Promise.reject(new Error("402"))),
      makeProvider("tavily", () => Promise.reject(new Error("429"))),
    ];
    const result = await countQueryHits("dead query", {
      providers,
      locales: [{ gl: "id", hl: "id" }],
      cursor: new RoundRobinCursor(),
      gotClient: fakeGot,
    });

    expect(result.hits).toBe(0);
    expect(result.provider).toBeUndefined();
    expect(result.failed).toBe(true);
  });

  it("does not mark a probe as failed when a provider returns zero results", async () => {
    const providers = [
      makeProvider("serper", () => Promise.resolve(hitsResult(0))),
    ];
    const result = await countQueryHits("quiet query", {
      providers,
      locales: [{ gl: "id", hl: "id" }],
      cursor: new RoundRobinCursor(),
      gotClient: fakeGot,
    });

    expect(result.hits).toBe(0);
    expect(result.failed).toBeFalsy();
  });

  it("fails over to the next provider and counts credits from the attempt that returned", async () => {
    const creditsSink: CreditsSink = { credits: 0 };
    const providers = [
      makeProvider("serper", () => Promise.reject(new Error("boom"))),
      makeProvider("tavily", () => Promise.resolve(hitsResult(4, 2))),
    ];
    const result = await countQueryHits("tomoro coffee", {
      providers,
      locales: [{ gl: "id", hl: "id" }],
      cursor: new RoundRobinCursor(),
      gotClient: fakeGot,
      creditsSink,
    });

    expect(result.hits).toBe(4);
    expect(result.provider).toBe("tavily");
    expect(creditsSink.credits).toBe(2);
  });
});
