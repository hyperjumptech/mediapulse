/** @vitest-environment node */
import { Prisma } from "@mediapulse/database";
import { describe, expect, it } from "vitest";

import { mergeTickerMetadataForPatch } from "./merge-ticker-metadata";

describe("mergeTickerMetadataForPatch", () => {
  it("returns undefined when incoming is undefined", () => {
    expect(mergeTickerMetadataForPatch({ a: 1 }, undefined)).toBeUndefined();
  });

  it("returns DbNull when incoming is null", () => {
    const result = mergeTickerMetadataForPatch({ a: 1 }, null);
    expect(result).toBe(Prisma.DbNull);
  });

  it("shallow-merges object into existing metadata", () => {
    const result = mergeTickerMetadataForPatch(
      { Sektor: "A", Extra: true },
      { Sektor: "B" },
    );
    expect(result).toEqual({ Sektor: "B", Extra: true });
  });

  it("uses empty base when existing is null", () => {
    const result = mergeTickerMetadataForPatch(null, { x: 1 });
    expect(result).toEqual({ x: 1 });
  });
});
