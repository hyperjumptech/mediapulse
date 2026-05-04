/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  HERMES_ENV_BUILD_TARGET_ORDER,
  resolveHermesEnvBuildTargets,
} from "./resolve-hermes-env-build-targets";

describe("resolveHermesEnvBuildTargets", () => {
  it("returns both targets when raw is undefined", () => {
    expect(resolveHermesEnvBuildTargets(undefined)).toEqual(
      HERMES_ENV_BUILD_TARGET_ORDER,
    );
  });

  it("returns both targets when raw is empty or all", () => {
    expect(resolveHermesEnvBuildTargets("")).toEqual(
      HERMES_ENV_BUILD_TARGET_ORDER,
    );
    expect(resolveHermesEnvBuildTargets("all")).toEqual(
      HERMES_ENV_BUILD_TARGET_ORDER,
    );
  });

  it("parses a single target", () => {
    expect(resolveHermesEnvBuildTargets("default")).toEqual(["default"]);
  });

  it("deduplicates and sorts subset", () => {
    expect(
      resolveHermesEnvBuildTargets("hermes.worker, default, hermes.worker"),
    ).toEqual(["default", "hermes.worker"]);
  });

  it("throws for unknown keys", () => {
    expect(() => resolveHermesEnvBuildTargets("default,unknown")).toThrow(
      /Unknown HERMES_ENV_BUILD_TARGETS/,
    );
  });
});
