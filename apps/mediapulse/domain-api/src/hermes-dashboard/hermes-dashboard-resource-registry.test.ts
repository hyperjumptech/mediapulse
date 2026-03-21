/** @vitest-environment node */
import type { DashboardPageInput } from "@hermes/domain-contract";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { defineHermesDashboardResource } from "./hermes-dashboard-resource-types";
import {
  buildDashboardManifestPages,
  buildHermesDashboardResourceConst,
  buildHermesDashboardRouteMounts,
} from "./hermes-dashboard-resource-registry";

const pageA = {
  id: "seg-a",
  label: "A",
  pathSegment: "seg-a",
  template: "table-v1" as const,
  apiPrefix: "/v1/hermes-dashboard/seg-a",
  order: 0,
  columns: [],
  actions: { create: false, update: false, delete: false },
} satisfies DashboardPageInput;

const pageB = {
  id: "seg-b",
  label: "B",
  pathSegment: "seg-b",
  template: "table-v1" as const,
  apiPrefix: "/v1/hermes-dashboard/seg-b",
  order: 0,
  columns: [],
  actions: { create: false, update: false, delete: false },
} satisfies DashboardPageInput;

describe("buildHermesDashboardResourceConst", () => {
  it("builds a segment map from definitions", () => {
    // Setup
    const appA = new Hono();
    const appB = new Hono();
    const resources = [
      defineHermesDashboardResource({
        resourceKey: "alpha",
        pathSegment: "seg-a",
        order: 1,
        routes: appA,
        dashboardPage: pageA,
      }),
      defineHermesDashboardResource({
        resourceKey: "beta",
        pathSegment: "seg-b",
        order: 2,
        routes: appB,
        dashboardPage: pageB,
      }),
    ] as const;

    // Act
    const map = buildHermesDashboardResourceConst(resources);

    // Assert
    expect(map.alpha).toBe("seg-a");
    expect(map.beta).toBe("seg-b");
  });

  it("throws when resourceKey is duplicated", () => {
    // Setup
    const app = new Hono();
    const resources = [
      defineHermesDashboardResource({
        resourceKey: "dup",
        pathSegment: "seg-a",
        order: 1,
        routes: app,
        dashboardPage: pageA,
      }),
      defineHermesDashboardResource({
        resourceKey: "dup",
        pathSegment: "seg-b",
        order: 2,
        routes: app,
        dashboardPage: pageB,
      }),
    ];

    // Act & Assert
    expect(() => buildHermesDashboardResourceConst(resources)).toThrow(
      "Duplicate Hermes dashboard resourceKey: dup",
    );
  });
});

describe("buildDashboardManifestPages", () => {
  it("sorts pages by registration order ascending", () => {
    // Setup
    const late = defineHermesDashboardResource({
      resourceKey: "late",
      pathSegment: "seg-b",
      order: 20,
      routes: new Hono(),
      dashboardPage: { ...pageB, order: 20 },
    });
    const early = defineHermesDashboardResource({
      resourceKey: "early",
      pathSegment: "seg-a",
      order: 10,
      routes: new Hono(),
      dashboardPage: { ...pageA, order: 10 },
    });
    const resources = [late, early];

    // Act
    const pages = buildDashboardManifestPages(resources);

    // Assert
    expect(pages.map((p) => p.id)).toEqual(["seg-a", "seg-b"]);
  });
});

describe("buildHermesDashboardRouteMounts", () => {
  it("sorts mounts by registration order ascending", () => {
    // Setup
    const appA = new Hono();
    const appB = new Hono();
    const second = defineHermesDashboardResource({
      resourceKey: "second",
      pathSegment: "seg-b",
      order: 2,
      routes: appB,
      dashboardPage: pageB,
    });
    const first = defineHermesDashboardResource({
      resourceKey: "first",
      pathSegment: "seg-a",
      order: 1,
      routes: appA,
      dashboardPage: pageA,
    });

    // Act
    const mounts = buildHermesDashboardRouteMounts([second, first]);

    // Assert
    expect(mounts.map((m) => m.segment)).toEqual(["seg-a", "seg-b"]);
    expect(mounts[0]?.app).toBe(appA);
    expect(mounts[1]?.app).toBe(appB);
  });
});
