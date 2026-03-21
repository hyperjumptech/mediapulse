/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { hermesDashboardRouteMounts } from "./hermes-dashboard-route-mounts";

describe("hermesDashboardRouteMounts", () => {
  it("re-exports mounts aligned with the resource registry", () => {
    // Assert
    expect(hermesDashboardRouteMounts.length).toBeGreaterThan(0);
    expect(hermesDashboardRouteMounts[0]?.segment).toBeDefined();
    expect(hermesDashboardRouteMounts[0]?.app).toBeDefined();
  });
});
