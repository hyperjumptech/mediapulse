/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { getPrismaEnumZodSchema } from "./default-prisma-enum-zod";

describe("getPrismaEnumZodSchema", () => {
  it("returns nativeEnum for CuratedSourceLinkType", () => {
    const s = getPrismaEnumZodSchema("CuratedSourceLinkType");

    expect(s).toBeDefined();
    expect(s!.safeParse("page").success).toBe(true);
    expect(s!.safeParse("listing").success).toBe(true);
    expect(s!.safeParse("rss").success).toBe(false);
  });

  it("returns undefined for unknown enum names", () => {
    // Act
    const s = getPrismaEnumZodSchema("NoSuchEnum");

    // Assert
    expect(s).toBeUndefined();
  });
});
