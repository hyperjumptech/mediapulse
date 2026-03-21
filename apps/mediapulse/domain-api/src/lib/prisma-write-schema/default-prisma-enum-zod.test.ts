/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { getPrismaEnumZodSchema } from "./default-prisma-enum-zod";

describe("getPrismaEnumZodSchema", () => {
  it("returns nativeEnum for Sentiment", () => {
    // Act
    const s = getPrismaEnumZodSchema("Sentiment");

    // Assert
    expect(s).toBeDefined();
    expect(s!.safeParse("POSITIVE").success).toBe(true);
    expect(s!.safeParse("NOPE").success).toBe(false);
  });

  it("returns undefined for unknown enum names", () => {
    // Act
    const s = getPrismaEnumZodSchema("NoSuchEnum");

    // Assert
    expect(s).toBeUndefined();
  });
});
