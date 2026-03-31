/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { BodySchema } from "./body-schema";

describe("BodySchema", () => {
  it("parses a valid body with tickerId only", async () => {
    // Act
    const result = await BodySchema.parseAsync({ tickerId: "123" });

    // Assert
    expect(result).toEqual({ tickerId: "123" });
  });

  it("parses a valid body with timeWindow", async () => {
    // Act
    const result = await BodySchema.parseAsync({
      tickerId: "123",
      timeWindow: {
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      },
    });

    // Assert
    expect(result.tickerId).toBe("123");
    expect(result.timeWindow).toBeDefined();
  });

  it("rejects an invalid body", async () => {
    // Act & Assert
    await expect(
      BodySchema.parseAsync({ tickerId: 123 }),
    ).rejects.toBeInstanceOf(Error);
  });
});
