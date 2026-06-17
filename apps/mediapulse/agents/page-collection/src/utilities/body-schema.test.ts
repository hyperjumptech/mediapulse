/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { BodySchema } from "./body-schema";

describe("BodySchema", () => {
  it("rejects an empty listingUrl", () => {
    expect(() => BodySchema.parse({ listingUrl: "" })).toThrow();
    expect(() => BodySchema.parse({ listingUrl: "   " })).toThrow();
  });

  it("accepts a literal listing URL", () => {
    const result = BodySchema.parse({
      listingUrl: "https://example.com/article",
    });

    expect(result.listingUrl).toBe("https://example.com/article");
  });

  it("accepts a db: curatedSource expansion string", () => {
    const expansion = "db:curatedSource:listingUrl?where.enabled=true";
    const result = BodySchema.parse({ listingUrl: expansion });

    expect(result.listingUrl).toBe(expansion);
  });

  it("trims surrounding whitespace from listingUrl", () => {
    const result = BodySchema.parse({
      listingUrl: "  https://example.com/article  ",
    });

    expect(result.listingUrl).toBe("https://example.com/article");
  });
});
