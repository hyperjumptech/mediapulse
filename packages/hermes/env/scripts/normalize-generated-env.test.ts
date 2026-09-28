/** @vitest-environment node */
import { readFileSync, writeFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const { normalizeGeneratedEnvFile, normalizeGeneratedEnvSource } =
  await import("./normalize-generated-env");

describe("normalizeGeneratedEnvSource", () => {
  it("rewrites env-to-t3 coerced numbers to zod 4 syntax", () => {
    const source = "PORT: z.number({ coerce: true }).optional(),";

    expect(normalizeGeneratedEnvSource(source)).toBe(
      "PORT: z.coerce.number().optional(),",
    );
  });
});

describe("normalizeGeneratedEnvFile", () => {
  afterEach(() => {
    vi.mocked(readFileSync).mockReset();
    vi.mocked(writeFileSync).mockReset();
  });

  it("writes the file only when something changed", () => {
    vi.mocked(readFileSync).mockReturnValueOnce("A: z.string(),");
    normalizeGeneratedEnvFile("src/index.ts");
    vi.mocked(readFileSync).mockReturnValueOnce(
      "B: z.number({ coerce: true }),",
    );
    normalizeGeneratedEnvFile("src/other.ts");

    expect(writeFileSync).toHaveBeenCalledTimes(1);
    expect(writeFileSync).toHaveBeenCalledWith(
      "src/other.ts",
      "B: z.coerce.number(),",
    );
  });
});
