/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  ExecutionConfigSchema,
  mergeExecutionConfig,
  parseEffectiveExecutionConfig,
} from "./execution-config";

describe("mergeExecutionConfig", () => {
  it("merges schedule overrides onto pipeline defaults", () => {
    const merged = mergeExecutionConfig(
      { schemaVersion: 1, stepRollupPolicy: "strict" },
      { stepRollupPolicy: "tolerant" },
    );
    expect(merged.stepRollupPolicy).toBe("tolerant");
    expect(merged.stepOrder).toBe("sequential");
  });

  it("parses effective config with defaults", () => {
    const cfg = parseEffectiveExecutionConfig({});
    expect(ExecutionConfigSchema.safeParse(cfg).success).toBe(true);
    expect(cfg.schemaVersion).toBe(1);
  });
});
