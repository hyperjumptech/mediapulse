/** @vitest-environment node */
import { execSync } from "node:child_process";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("./normalize-generated-env", () => ({
  normalizeGeneratedEnvFile: vi.fn(),
}));

const { runHermesEnvCodegen } = await import("./run-hermes-env-build");
const { normalizeGeneratedEnvFile } = await import("./normalize-generated-env");

describe("runHermesEnvCodegen", () => {
  beforeEach(() => {
    vi.mocked(execSync).mockClear();
  });

  it("runs env-to-t3 once when only default is requested", () => {
    runHermesEnvCodegen("default");
    expect(execSync).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(execSync).mock.calls[0]?.[0])).toContain(
      "env.example",
    );
  });

  it("runs env-to-t3 twice when both slices are requested", () => {
    runHermesEnvCodegen("default,hermes.worker");
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(execSync).mock.calls[1]?.[0])).toContain(
      "env.hermes-worker.example",
    );
  });

  it("normalizes each generated file for zod 4", () => {
    vi.mocked(normalizeGeneratedEnvFile).mockClear();

    runHermesEnvCodegen("default");

    expect(normalizeGeneratedEnvFile).toHaveBeenCalledTimes(1);
    expect(
      String(vi.mocked(normalizeGeneratedEnvFile).mock.calls[0]?.[0]),
    ).toContain(path.join("env", "src/index.ts"));
  });
});
