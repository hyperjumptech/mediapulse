/** @vitest-environment node */
import { execSync } from "node:child_process";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const { runHermesEnvCodegen } = await import("./run-hermes-env-build");

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
});
