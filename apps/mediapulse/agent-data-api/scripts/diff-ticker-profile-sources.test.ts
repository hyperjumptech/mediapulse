import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({ prisma: {} }));
vi.mock("@mediapulse/env", () => ({ env: {} }));

import { parseDiffOptions } from "./diff-ticker-profile-sources.js";

describe("parseDiffOptions", () => {
  it("reads repeated symbols and the flags", () => {
    expect(
      parseDiffOptions([
        "--",
        "--symbol",
        "mapb",
        "--symbol",
        "FORE",
        "--active-only",
        "--json",
        "--fail-on-missing-active",
      ]),
    ).toEqual({
      symbols: ["MAPB", "FORE"],
      activeOnly: true,
      json: true,
      failOnMissingActive: true,
    });
  });

  it("rejects an unknown option and a symbol flag with no value", () => {
    expect(() => parseDiffOptions(["--everything"])).toThrow(
      "Unknown option --everything",
    );
    expect(() => parseDiffOptions(["--symbol"])).toThrow(
      "--symbol needs a ticker symbol",
    );
  });
});
