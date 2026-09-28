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

const { runMediapulseEnvCodegen } = await import("./run-mediapulse-env-build");
const { normalizeGeneratedEnvFile } = await import("./normalize-generated-env");

describe("runMediapulseEnvCodegen", () => {
  beforeEach(() => {
    vi.mocked(execSync).mockClear();
  });

  it("runs env-to-t3 once per resolved target", () => {
    runMediapulseEnvCodegen("agents.delivery");
    expect(execSync).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(execSync).mock.calls[0]?.[0])).toContain(
      "env.agents.delivery.example",
    );
  });

  it("runs env-to-t3 for each target in canonical multi-target list", () => {
    runMediapulseEnvCodegen("default,app.user-registration");
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(execSync).mock.calls[0]?.[0])).toContain(
      "env.example",
    );
    expect(String(vi.mocked(execSync).mock.calls[1]?.[0])).toContain(
      "env.app.user-registration.example",
    );
  });

  it("normalizes each generated file for zod 4", () => {
    vi.mocked(normalizeGeneratedEnvFile).mockClear();

    runMediapulseEnvCodegen("agents.delivery");

    expect(normalizeGeneratedEnvFile).toHaveBeenCalledTimes(1);
    expect(
      String(vi.mocked(normalizeGeneratedEnvFile).mock.calls[0]?.[0]),
    ).toContain(path.join("env", "src/agents-delivery.ts"));
  });
});
