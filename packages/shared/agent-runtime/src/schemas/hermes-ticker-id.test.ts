/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { hermesTickerIdSchema } from "./hermes-ticker-id.js";

describe("hermesTickerIdSchema", () => {
  it("accepts a UUID", async () => {
    const id = "11111111-1111-4111-a111-111111111111";
    await expect(hermesTickerIdSchema.parseAsync(id)).resolves.toBe(id);
  });

  it("accepts a non-UUID opaque id", async () => {
    await expect(hermesTickerIdSchema.parseAsync("tid-1")).resolves.toBe(
      "tid-1",
    );
  });

  it("accepts a db: expansion string", async () => {
    const s = "db:ticker:id?take=100";
    await expect(hermesTickerIdSchema.parseAsync(s)).resolves.toBe(s);
  });

  it("trims leading and trailing whitespace", async () => {
    await expect(hermesTickerIdSchema.parseAsync("  abc  ")).resolves.toBe(
      "abc",
    );
  });

  it("rejects empty string", async () => {
    await expect(hermesTickerIdSchema.parseAsync("")).rejects.toBeInstanceOf(
      Error,
    );
  });

  it("rejects whitespace-only string", async () => {
    await expect(hermesTickerIdSchema.parseAsync("   ")).rejects.toBeInstanceOf(
      Error,
    );
  });
});
