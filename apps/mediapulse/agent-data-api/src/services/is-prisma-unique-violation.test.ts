/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { isPrismaUniqueViolation } from "./is-prisma-unique-violation";

describe("isPrismaUniqueViolation", () => {
  it("returns true for Prisma P2002 errors", () => {
    // Act
    const result = isPrismaUniqueViolation({ code: "P2002" });

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for other Prisma errors", () => {
    // Act
    const result = isPrismaUniqueViolation({ code: "P2025" });

    // Assert
    expect(result).toBe(false);
  });

  it("returns false for non-object errors", () => {
    // Act
    const result = isPrismaUniqueViolation("boom");

    // Assert
    expect(result).toBe(false);
  });
});
