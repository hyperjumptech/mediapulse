/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { formatCreatedBy } from "./format-created-by";

describe("formatCreatedBy", () => {
  it("returns creator name when present", () => {
    // Act
    const result = formatCreatedBy({
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });

    // Assert
    expect(result).toBe("Ada Lovelace");
  });

  it("falls back to creator email when name is empty", () => {
    // Act
    const result = formatCreatedBy({
      id: "user-1",
      name: "  ",
      email: "ada@example.com",
    });

    // Assert
    expect(result).toBe("ada@example.com");
  });

  it("falls back to explicit createdById when relation is missing", () => {
    // Act
    const result = formatCreatedBy(null, "user-42");

    // Assert
    expect(result).toBe("user-42");
  });

  it("returns em dash when no creator fields are available", () => {
    // Act
    const result = formatCreatedBy({ id: null, name: null, email: null });

    // Assert
    expect(result).toBe("—");
  });
});
