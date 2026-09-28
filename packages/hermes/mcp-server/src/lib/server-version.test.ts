import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parsePackageVersion, readServerVersion } from "./server-version.js";

describe("readServerVersion", () => {
  it("reads the version from the package's package.json", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { name: string; version: string };

    const version = readServerVersion();

    expect(packageJson.name).toBe("@hermes/mcp-server");
    expect(version).toBe(packageJson.version);
  });

  it("uses an injected reader", () => {
    expect(readServerVersion(() => '{"version":"9.9.9"}')).toBe("9.9.9");
  });
});

describe("parsePackageVersion", () => {
  it("falls back when the version is missing", () => {
    expect(parsePackageVersion("{}")).toBe("0.0.0");
  });
});
