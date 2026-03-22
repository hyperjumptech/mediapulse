/** @vitest-environment node */
import type { DashboardPageInput } from "@hermes/domain-contract";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  defineHermesDashboardResource,
  type HermesDashboardResourceDefinition,
} from "./hermes-dashboard-resource-types";

const minimalDashboardPage = {
  id: "test-seg",
  label: "Test",
  pathSegment: "test-seg",
  template: "table-v1" as const,
  apiPrefix: "/v1/hermes-dashboard/test-seg",
  order: 0,
  columns: [],
  actions: { create: false, update: false, delete: false },
} satisfies DashboardPageInput;

describe("defineHermesDashboardResource", () => {
  it("returns the same definition object (identity)", () => {
    // Setup
    const routes = new Hono();
    const input: HermesDashboardResourceDefinition<"testKey", "test-seg"> = {
      resourceKey: "testKey",
      pathSegment: "test-seg",
      order: 1,
      routes,
      dashboardPage: minimalDashboardPage,
    };

    // Act
    const result = defineHermesDashboardResource(input);

    // Assert
    expect(result).toBe(input);
    expect(result.resourceKey).toBe("testKey");
    expect(result.pathSegment).toBe("test-seg");
    expect(result.routes).toBe(routes);
  });
});
