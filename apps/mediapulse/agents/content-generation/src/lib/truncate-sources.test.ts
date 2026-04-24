import { afterEach, describe, expect, it, vi } from "vitest";

import { truncateSources } from "./truncate-sources.js";
import type { SourceForGeneration } from "../types.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const makeSource = (title: string, content: string): SourceForGeneration => ({
  url: `https://example.com/${title.toLowerCase()}`,
  title,
  content,
});

describe("truncateSources", () => {
  it("returns sources unchanged when within both limits", () => {
    const sources = [makeSource("A", "short"), makeSource("B", "also short")];

    const result = truncateSources(sources, 8000, 100000);

    expect(result).toEqual(sources);
  });

  it("truncates a single source exceeding maxCharsPerSource from the tail", () => {
    const sources = [makeSource("A", "a".repeat(10000))];

    const result = truncateSources(sources, 500, 100000);

    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("a".repeat(500));
    expect(result[0]!.title).toBe("A");
  });

  it("does not modify sources within maxCharsPerSource", () => {
    const sources = [makeSource("A", "abc")];

    const result = truncateSources(sources, 8000, 100000);

    expect(result[0]!.content).toBe("abc");
  });

  it("drops sources from the end when total exceeds maxTotalContextChars", () => {
    const sources = [
      makeSource("A", "a".repeat(400)),
      makeSource("B", "b".repeat(400)),
      makeSource("C", "c".repeat(400)),
    ];

    const result = truncateSources(sources, 8000, 900);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("A");
    expect(result[1]!.title).toBe("B");
  });

  it("keeps at least one source even when it exceeds maxTotalContextChars, truncating it to maxTotalContextChars", () => {
    const sources = [makeSource("Big", "x".repeat(5000))];

    const result = truncateSources(sources, 8000, 200);

    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("x".repeat(200));
    expect(result[0]!.title).toBe("Big");
  });

  it("returns empty array unchanged", () => {
    const result = truncateSources([], 8000, 100000);

    expect(result).toEqual([]);
  });

  it("applies per-source truncation before total context cap", () => {
    const sources = [
      makeSource("A", "a".repeat(600)),
      makeSource("B", "b".repeat(200)),
      makeSource("C", "c".repeat(200)),
    ];

    const result = truncateSources(sources, 300, 500);

    expect(result).toHaveLength(2);
    expect(result[0]!.content).toBe("a".repeat(300));
    expect(result[0]!.title).toBe("A");
    expect(result[1]!.content).toBe("b".repeat(200));
    expect(result[1]!.title).toBe("B");
  });

  it("drops only as many sources as needed to fit total context cap", () => {
    const sources = [
      makeSource("A", "a".repeat(200)),
      makeSource("B", "b".repeat(200)),
      makeSource("C", "c".repeat(200)),
      makeSource("D", "d".repeat(200)),
    ];

    const result = truncateSources(sources, 8000, 600);

    expect(result).toHaveLength(3);
    expect(result.map((s) => s.title)).toEqual(["A", "B", "C"]);
  });
});
