/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  DOMAIN_API_V1_PREFIX,
  HERMES_DASHBOARD_V1_MOUNT_PATH,
  hermesDashboardManifestApiPrefix,
  hermesDashboardTableMountPath,
  STEP_INPUT_DOMAIN_API_PATHS,
} from "./hermes-dashboard-path-helpers";

describe("hermes-dashboard-path-helpers", () => {
  it("exposes stable v1 and dashboard path constants", () => {
    // Assert
    expect(DOMAIN_API_V1_PREFIX).toBe("/v1");
    expect(HERMES_DASHBOARD_V1_MOUNT_PATH).toBe("/hermes-dashboard");
    expect(STEP_INPUT_DOMAIN_API_PATHS.previewExpansion).toBe(
      "/preview-expansion",
    );
    expect(STEP_INPUT_DOMAIN_API_PATHS.expandStepInputs).toBe(
      "/expand-step-inputs",
    );
  });

  it("builds mount path from segment", () => {
    // Act
    const path = hermesDashboardTableMountPath("tickers");

    // Assert
    expect(path).toBe("/hermes-dashboard/tickers");
  });

  it("builds manifest apiPrefix from segment", () => {
    // Act
    const prefix = hermesDashboardManifestApiPrefix("mediapulse-users");

    // Assert
    expect(prefix).toBe("/v1/hermes-dashboard/mediapulse-users");
  });
});
