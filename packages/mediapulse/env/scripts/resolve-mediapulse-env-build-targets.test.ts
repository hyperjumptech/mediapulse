/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  MEDIAPULSE_ENV_BUILD_TARGET_ORDER,
  resolveMediapulseEnvBuildTargets,
} from "./resolve-mediapulse-env-build-targets";

describe("resolveMediapulseEnvBuildTargets", () => {
  it("returns full ordered list when raw is undefined", () => {
    expect(resolveMediapulseEnvBuildTargets(undefined)).toEqual(
      MEDIAPULSE_ENV_BUILD_TARGET_ORDER,
    );
  });

  it("returns full ordered list when raw is empty or whitespace", () => {
    expect(resolveMediapulseEnvBuildTargets("")).toEqual(
      MEDIAPULSE_ENV_BUILD_TARGET_ORDER,
    );
    expect(resolveMediapulseEnvBuildTargets("   ")).toEqual(
      MEDIAPULSE_ENV_BUILD_TARGET_ORDER,
    );
  });

  it("returns full ordered list when raw is all (case-sensitive per spec)", () => {
    expect(resolveMediapulseEnvBuildTargets("all")).toEqual(
      MEDIAPULSE_ENV_BUILD_TARGET_ORDER,
    );
  });

  it("parses a single target", () => {
    expect(resolveMediapulseEnvBuildTargets("agents.delivery")).toEqual([
      "agents.delivery",
    ]);
  });

  it("deduplicates and sorts subset to canonical order", () => {
    expect(
      resolveMediapulseEnvBuildTargets(
        "agents.delivery, default, agents.delivery",
      ),
    ).toEqual(["default", "agents.delivery"]);
  });

  it("throws for unknown keys", () => {
    expect(() =>
      resolveMediapulseEnvBuildTargets("agents.unknown,default"),
    ).toThrow(/Unknown MEDIAPULSE_ENV_BUILD_TARGETS/);
  });
});
