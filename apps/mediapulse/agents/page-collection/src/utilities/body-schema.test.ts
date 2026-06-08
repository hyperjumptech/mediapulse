/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { BodySchema } from "./body-schema";

describe("BodySchema", () => {
  it("parses a valid body with tickerId only", async () => {
    const result = await BodySchema.parseAsync({ tickerId: "123" });

    expect(result).toEqual({ tickerId: "123" });
  });

  it("trims tickerId whitespace", async () => {
    const result = await BodySchema.parseAsync({ tickerId: "  123  " });

    expect(result.tickerId).toBe("123");
  });

  it("rejects empty tickerId", async () => {
    await expect(
      BodySchema.parseAsync({ tickerId: "" }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("rejects missing tickerId", async () => {
    await expect(BodySchema.parseAsync({})).rejects.toBeInstanceOf(Error);
  });

  it("rejects extra fields (strict: false, extra fields are stripped by default)", async () => {
    const result = await BodySchema.parseAsync({
      tickerId: "abc",
      extra: "value",
    });

    expect(result).not.toHaveProperty("extra");
  });
});
