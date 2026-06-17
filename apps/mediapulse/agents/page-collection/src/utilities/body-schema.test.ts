/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { BodySchema } from "./body-schema";

describe("BodySchema", () => {
  it("requires at least one source URL", () => {
    expect(() => BodySchema.parse({ sourceUrls: [] })).toThrow();
  });

  it("accepts an array of URLs", () => {
    const result = BodySchema.parse({
      sourceUrls: ["https://example.com/article"],
    });

    expect(result.sourceUrls).toHaveLength(1);
  });
});
