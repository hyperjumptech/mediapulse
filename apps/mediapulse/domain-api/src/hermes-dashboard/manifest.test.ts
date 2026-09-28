import { describe, expect, it } from "vitest";
import { dashboardManifest } from "./manifest";
import { HermesDashboardResource } from "./paths";
import { hermesDashboardResources } from "./hermes-dashboard-resource-registry";

const resourceTableViews = dashboardManifest.views.flatMap((view) =>
  view.kind === "resource-table" ? [view] : [],
);

describe("dashboardManifest", () => {
  it("matches the registered resource list order and ids", () => {
    const sorted = [...hermesDashboardResources].sort(
      (a, b) => a.order - b.order,
    );

    const resourcePageIds = resourceTableViews.map((p) => p.id);

    expect(resourcePageIds).toEqual(sorted.map((r) => r.dashboardPage.id));
    expect(dashboardManifest.templateVersion).toBe(1);
  });

  it("uses unique path segments for every page", () => {
    const segments = dashboardManifest.views
      .map((p) => p.pathSegment)
      .filter((segment): segment is string => segment != null);

    expect(new Set(segments).size).toBe(segments.length);
  });

  it("maps every HermesDashboardResource entry to a manifest page with matching id", () => {
    for (const key of Object.keys(
      HermesDashboardResource,
    ) as (keyof typeof HermesDashboardResource)[]) {
      const segment = HermesDashboardResource[key];
      const page = dashboardManifest.views.find(
        (p) => p.pathSegment === segment,
      );

      expect(page, `missing page for ${String(key)}`).toBeDefined();
      expect(page?.id).toBe(segment);
      expect(page?.pathSegment).toBe(segment);
    }
  });

  it("keeps sidebar page order monotonic by page order field", () => {
    const orders = dashboardManifest.views
      .filter((p) => p.placement === "sidebar")
      .map((p) => p.order);
    const sorted = [...orders].sort((a, b) => a - b);

    expect(orders).toEqual(sorted);
  });
});

describe("dashboardManifest resource-table columns", () => {
  it("keeps every display hint through contract parsing", () => {
    for (const resource of hermesDashboardResources) {
      const source = resource.dashboardPage;
      const sourceColumns = "columns" in source ? source.columns : undefined;
      const parsed = resourceTableViews.find((view) => view.id === source.id);

      expect(sourceColumns, source.id).toBeDefined();
      expect(parsed?.columns, source.id).toEqual(sourceColumns);
    }
  });

  it("gives each phone card at most one subtitle and one badge", () => {
    for (const view of resourceTableViews) {
      const subtitles = view.columns.filter(
        (column) => column.mobile === "subtitle",
      );
      const badges = view.columns.filter((column) => column.mobile === "badge");

      expect(subtitles.length, view.id).toBeLessThanOrEqual(1);
      expect(badges.length, view.id).toBeLessThanOrEqual(1);
    }
  });

  it("leaves the first column as the phone card title", () => {
    for (const view of resourceTableViews) {
      const firstColumn = view.columns[0];

      expect(firstColumn?.mobile ?? "title", view.id).toBe("title");
      expect(firstColumn?.hideBelow, view.id).toBeUndefined();
      expect(firstColumn?.defaultHidden, view.id).toBeUndefined();
    }
  });

  it("sets badge tones only on badge columns", () => {
    for (const view of resourceTableViews) {
      const tonedColumnFormats = view.columns
        .filter((column) => column.badgeTones !== undefined)
        .map((column) => column.format);

      expect(
        tonedColumnFormats.every((format) => format === "badge"),
        view.id,
      ).toBe(true);
    }
  });

  it("marks every date column for both old and new dashboards", () => {
    const dateFormats = new Set(["date-time", "date"]);

    for (const view of resourceTableViews) {
      const mismatched = view.columns
        .filter(
          (column) =>
            (column.type === "date-time") !==
            dateFormats.has(column.format ?? ""),
        )
        .map((column) => column.key);

      expect(mismatched, view.id).toEqual([]);
    }
  });
});
