/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildStorylineCitationCounts,
  type BuildStorylineCitationCountsDeps,
} from "./list-aggregates";

const findMany = vi.fn();
const deps = {
  development: { findMany },
} as unknown as BuildStorylineCitationCountsDeps;

beforeEach(() => {
  findMany.mockReset();
});

describe("buildStorylineCitationCounts", () => {
  it("skips the query entirely for an empty page", async () => {
    const counts = await buildStorylineCitationCounts([], deps);

    expect(counts.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("sums citations across every development of a storyline", async () => {
    findMany.mockResolvedValue([
      { storylineId: "s1", _count: { citations: 3 } },
      { storylineId: "s1", _count: { citations: 4 } },
      { storylineId: "s2", _count: { citations: 1 } },
    ]);

    const counts = await buildStorylineCitationCounts(["s1", "s2"], deps);

    expect(counts.get("s1")).toBe(7);
    expect(counts.get("s2")).toBe(1);
  });

  it("reports zero for a storyline with no developments", async () => {
    findMany.mockResolvedValue([]);

    const counts = await buildStorylineCitationCounts(["s1"], deps);

    expect(counts.get("s1")).toBe(0);
  });

  it("queries only the storylines on the page", async () => {
    findMany.mockResolvedValue([]);

    await buildStorylineCitationCounts(["s1", "s2"], deps);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storylineId: { in: ["s1", "s2"] } },
      }),
    );
  });
});
