import { describe, expect, it } from "vitest";
import type { DashboardView, ResourceTableView } from "@hermes/domain-contract";

import {
  buildDashboardBreadcrumbs,
  buildDomainIntegrationViewHref,
  dashboardNavGroups,
  isDashboardPathActive,
  type DomainIntegrationNav,
} from "./dashboard-routes";

const PIPELINE_ID = "550e8400-e29b-41d4-a716-446655440000";
const SCHEDULE_ID = "7d444840-9dc0-11d1-b245-5ffdce74fad2";
const EXECUTION_ID = "a3bb189e-8bf9-3888-9912-ace4e6543002";
const ITEM_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

const createResourceTableView = (
  pathSegment: string,
  label: string,
  canView: boolean,
): ResourceTableView => ({
  id: pathSegment,
  label,
  pathSegment,
  kind: "resource-table",
  placement: "sidebar",
  apiPrefix: `/v1/hermes-dashboard/${pathSegment}`,
  columns: [],
  searchableFields: [],
  sortableFields: [],
  actions: { create: true, update: true, delete: true, view: canView },
  order: 0,
  customActions: [],
  createNavigation: "modal",
});

const reportView: DashboardView = {
  id: "report",
  label: "Daily report",
  pathSegment: "report",
  kind: "markdown",
  placement: "sidebar",
  apiPrefix: "/v1/hermes-dashboard/report",
  order: 5,
};

const mediapulseIntegration: DomainIntegrationNav = {
  integrationId: "mediapulse",
  name: "Mediapulse",
  views: [
    createResourceTableView("tickers", "Tickers", false),
    createResourceTableView("articles", "Articles", true),
    reportView,
  ],
};

const domainIntegrations = [mediapulseIntegration];

const build = (pathname: string | null, entityLabels?: Map<string, string>) =>
  buildDashboardBreadcrumbs({ pathname, domainIntegrations, entityLabels });

describe("dashboardNavGroups", () => {
  it("lists the Hermes sections in sidebar order", () => {
    // Act
    const groupSummaries = dashboardNavGroups.map((group) => ({
      label: group.label,
      items: group.items.map((item) => item.label),
    }));

    // Assert
    expect(groupSummaries).toEqual([
      { label: "Overview", items: ["Dashboard"] },
      {
        label: "Orchestration",
        items: ["Pipelines", "Schedules", "HTTP triggers"],
      },
      {
        label: "Agents",
        items: ["Agents", "Agent configs", "Agent contracts", "Variables"],
      },
      {
        label: "Platform",
        items: ["Domain integrations", "API keys", "Admins"],
      },
    ]);
  });

  it("gives every item a dashboard href and an icon", () => {
    // Act
    const items = dashboardNavGroups.flatMap((group) => group.items);

    // Assert
    for (const item of items) {
      expect(item.href.startsWith("/dashboard")).toBe(true);
      expect(item.icon).toBeTruthy();
    }
  });
});

describe("isDashboardPathActive", () => {
  it("matches the dashboard root only on an exact path", () => {
    // Assert
    expect(isDashboardPathActive("/dashboard", "/dashboard")).toBe(true);
    expect(isDashboardPathActive("/dashboard/pipelines", "/dashboard")).toBe(
      false,
    );
  });

  it("matches a section and its nested routes", () => {
    // Assert
    expect(
      isDashboardPathActive("/dashboard/pipelines", "/dashboard/pipelines"),
    ).toBe(true);
    expect(
      isDashboardPathActive(
        `/dashboard/pipelines/${PIPELINE_ID}`,
        "/dashboard/pipelines",
      ),
    ).toBe(true);
  });

  it("does not match a sibling section that shares a prefix", () => {
    // Assert
    expect(
      isDashboardPathActive("/dashboard/agent-configs", "/dashboard/agent"),
    ).toBe(false);
    expect(
      isDashboardPathActive("/dashboard/agents-archive", "/dashboard/agents"),
    ).toBe(false);
  });

  it("returns false without a pathname", () => {
    // Assert
    expect(isDashboardPathActive(null, "/dashboard")).toBe(false);
  });
});

describe("buildDomainIntegrationViewHref", () => {
  it("uses the view path segment", () => {
    // Act
    const href = buildDomainIntegrationViewHref("mediapulse", {
      id: "tickers-view",
      pathSegment: "tickers",
    });

    // Assert
    expect(href).toBe("/dashboard/mediapulse/tickers");
  });

  it("falls back to the view id when the path segment is missing", () => {
    // Act
    const href = buildDomainIntegrationViewHref("mediapulse", {
      id: "tickers",
      pathSegment: undefined,
    });

    // Assert
    expect(href).toBe("/dashboard/mediapulse/tickers");
  });
});

describe("buildDashboardBreadcrumbs", () => {
  describe("dashboard root", () => {
    it("returns Dashboard for /dashboard", () => {
      // Assert
      expect(build("/dashboard")).toEqual([{ label: "Dashboard" }]);
    });

    it("returns Dashboard for a missing pathname", () => {
      // Assert
      expect(build(null)).toEqual([{ label: "Dashboard" }]);
    });

    it("returns Dashboard for a path outside the dashboard", () => {
      // Assert
      expect(build("/login")).toEqual([{ label: "Dashboard" }]);
    });
  });

  describe("Hermes sections", () => {
    it("returns the section label for a section index", () => {
      // Assert
      expect(build("/dashboard/pipelines")).toEqual([{ label: "Pipelines" }]);
      expect(build("/dashboard/http-triggers")).toEqual([
        { label: "HTTP triggers" },
      ]);
      expect(build("/dashboard/api-keys")).toEqual([{ label: "API keys" }]);
    });

    it("ignores a trailing slash", () => {
      // Assert
      expect(build("/dashboard/schedules/")).toEqual([{ label: "Schedules" }]);
    });

    it("never gives the current page an href", () => {
      // Act
      const breadcrumbs = build(`/dashboard/pipelines/${PIPELINE_ID}`);
      const currentPage = breadcrumbs.at(-1);

      // Assert
      expect(currentPage).not.toHaveProperty("href");
    });
  });

  describe("entity detail pages", () => {
    it("falls back to the entity noun without a registered label", () => {
      // Assert
      expect(build(`/dashboard/pipelines/${PIPELINE_ID}`)).toEqual([
        { label: "Pipelines", href: "/dashboard/pipelines" },
        { label: "Pipeline" },
      ]);
      expect(build(`/dashboard/schedules/${SCHEDULE_ID}`)).toEqual([
        { label: "Schedules", href: "/dashboard/schedules" },
        { label: "Schedule" },
      ]);
      expect(build("/dashboard/http-triggers/trigger-1")).toEqual([
        { label: "HTTP triggers", href: "/dashboard/http-triggers" },
        { label: "HTTP trigger" },
      ]);
      expect(build("/dashboard/agents/agent-1")).toEqual([
        { label: "Agents", href: "/dashboard/agents" },
        { label: "Agent" },
      ]);
    });

    it("uses the registered entity label", () => {
      // Setup
      const entityLabels = new Map([[PIPELINE_ID, "Nightly ingest"]]);

      // Act
      const breadcrumbs = build(
        `/dashboard/pipelines/${PIPELINE_ID}`,
        entityLabels,
      );

      // Assert
      expect(breadcrumbs).toEqual([
        { label: "Pipelines", href: "/dashboard/pipelines" },
        { label: "Nightly ingest" },
      ]);
    });

    it("labels unknown trailing segments by humanizing them", () => {
      // Assert
      expect(build(`/dashboard/schedules/${SCHEDULE_ID}/executions`)).toEqual([
        { label: "Schedules", href: "/dashboard/schedules" },
        { label: "Schedule", href: `/dashboard/schedules/${SCHEDULE_ID}` },
        { label: "Executions" },
      ]);
    });
  });

  describe("execution pages", () => {
    it("links the schedule and ends on the execution", () => {
      // Setup
      const entityLabels = new Map([[SCHEDULE_ID, "Morning run"]]);

      // Act
      const breadcrumbs = build(
        `/dashboard/schedules/${SCHEDULE_ID}/executions/${EXECUTION_ID}`,
        entityLabels,
      );

      // Assert
      expect(breadcrumbs).toEqual([
        { label: "Schedules", href: "/dashboard/schedules" },
        { label: "Morning run", href: `/dashboard/schedules/${SCHEDULE_ID}` },
        { label: "Execution" },
      ]);
    });

    it("falls back to the schedule noun without a registered label", () => {
      // Act
      const breadcrumbs = build(
        `/dashboard/schedules/${SCHEDULE_ID}/executions/${EXECUTION_ID}`,
      );

      // Assert
      expect(breadcrumbs).toEqual([
        { label: "Schedules", href: "/dashboard/schedules" },
        { label: "Schedule", href: `/dashboard/schedules/${SCHEDULE_ID}` },
        { label: "Execution" },
      ]);
    });

    it("adds Processed URLs after a linked execution", () => {
      // Act
      const breadcrumbs = build(
        `/dashboard/schedules/${SCHEDULE_ID}/executions/${EXECUTION_ID}/processed-urls`,
      );

      // Assert
      expect(breadcrumbs).toEqual([
        { label: "Schedules", href: "/dashboard/schedules" },
        { label: "Schedule", href: `/dashboard/schedules/${SCHEDULE_ID}` },
        {
          label: "Execution",
          href: `/dashboard/schedules/${SCHEDULE_ID}/executions/${EXECUTION_ID}`,
        },
        { label: "Processed URLs" },
      ]);
    });

    it("handles pipeline and HTTP trigger executions", () => {
      // Assert
      expect(
        build(`/dashboard/pipelines/${PIPELINE_ID}/executions/${EXECUTION_ID}`),
      ).toEqual([
        { label: "Pipelines", href: "/dashboard/pipelines" },
        { label: "Pipeline", href: `/dashboard/pipelines/${PIPELINE_ID}` },
        { label: "Execution" },
      ]);
      expect(
        build(`/dashboard/http-triggers/trigger-1/executions/${EXECUTION_ID}`),
      ).toEqual([
        { label: "HTTP triggers", href: "/dashboard/http-triggers" },
        { label: "HTTP trigger", href: "/dashboard/http-triggers/trigger-1" },
        { label: "Execution" },
      ]);
    });

    it("uses a registered execution label", () => {
      // Setup
      const entityLabels = new Map([[EXECUTION_ID, "Run #42"]]);

      // Act
      const breadcrumbs = build(
        `/dashboard/pipelines/${PIPELINE_ID}/executions/${EXECUTION_ID}`,
        entityLabels,
      );

      // Assert
      expect(breadcrumbs.at(-1)).toEqual({ label: "Run #42" });
    });
  });

  describe("create and edit pages", () => {
    it("labels agent config creation as New", () => {
      // Assert
      expect(build("/dashboard/agent-configs/new")).toEqual([
        { label: "Agent configs", href: "/dashboard/agent-configs" },
        { label: "New" },
      ]);
    });

    it("does not link an agent config that has no detail page", () => {
      // Assert
      expect(build("/dashboard/agent-configs/config-1/edit")).toEqual([
        { label: "Agent configs", href: "/dashboard/agent-configs" },
        { label: "Agent config" },
        { label: "Edit" },
      ]);
    });

    it("uses the registered agent config label on the edit page", () => {
      // Setup
      const entityLabels = new Map([["config-1", "Default summarizer"]]);

      // Act
      const breadcrumbs = build(
        "/dashboard/agent-configs/config-1/edit",
        entityLabels,
      );

      // Assert
      expect(breadcrumbs).toEqual([
        { label: "Agent configs", href: "/dashboard/agent-configs" },
        { label: "Default summarizer" },
        { label: "Edit" },
      ]);
    });

    it("labels domain integration creation as New", () => {
      // Assert
      expect(build("/dashboard/domain-integrations/create")).toEqual([
        {
          label: "Domain integrations",
          href: "/dashboard/domain-integrations",
        },
        { label: "New" },
      ]);
    });
  });

  describe("content generation runs", () => {
    it("labels the runs index as CGA diagnostics", () => {
      // Assert
      expect(build("/dashboard/agents/content-generation-runs")).toEqual([
        { label: "Agents", href: "/dashboard/agents" },
        { label: "CGA diagnostics" },
      ]);
    });

    it("links the runs index from a run detail", () => {
      // Assert
      expect(
        build(`/dashboard/agents/content-generation-runs/${EXECUTION_ID}`),
      ).toEqual([
        { label: "Agents", href: "/dashboard/agents" },
        {
          label: "CGA diagnostics",
          href: "/dashboard/agents/content-generation-runs",
        },
        { label: "Run detail" },
      ]);
    });

    it("humanizes segments after a run detail", () => {
      // Act
      const breadcrumbs = build(
        `/dashboard/agents/content-generation-runs/${EXECUTION_ID}/raw-output`,
      );

      // Assert
      expect(breadcrumbs.slice(-2)).toEqual([
        {
          label: "Run detail",
          href: `/dashboard/agents/content-generation-runs/${EXECUTION_ID}`,
        },
        { label: "Raw output" },
      ]);
    });
  });

  describe("domain integration pages", () => {
    it("shows the integration name and view label", () => {
      // Assert
      expect(build("/dashboard/mediapulse/tickers")).toEqual([
        { label: "Mediapulse" },
        { label: "Tickers" },
      ]);
    });

    it("shows only the integration name at the integration root", () => {
      // Assert
      expect(build("/dashboard/mediapulse")).toEqual([{ label: "Mediapulse" }]);
    });

    it("labels item creation as New", () => {
      // Assert
      expect(build("/dashboard/mediapulse/tickers/new")).toEqual([
        { label: "Mediapulse" },
        { label: "Tickers", href: "/dashboard/mediapulse/tickers" },
        { label: "New" },
      ]);
    });

    it("falls back to Detail for an item without a registered label", () => {
      // Assert
      expect(build(`/dashboard/mediapulse/articles/${ITEM_ID}`)).toEqual([
        { label: "Mediapulse" },
        { label: "Articles", href: "/dashboard/mediapulse/articles" },
        { label: "Detail" },
      ]);
    });

    it("links the item on its edit page when the view has a detail page", () => {
      // Setup
      const entityLabels = new Map([[ITEM_ID, "Rate cut coverage"]]);

      // Act
      const breadcrumbs = build(
        `/dashboard/mediapulse/articles/${ITEM_ID}/edit`,
        entityLabels,
      );

      // Assert
      expect(breadcrumbs).toEqual([
        { label: "Mediapulse" },
        { label: "Articles", href: "/dashboard/mediapulse/articles" },
        {
          label: "Rate cut coverage",
          href: `/dashboard/mediapulse/articles/${ITEM_ID}`,
        },
        { label: "Edit" },
      ]);
    });

    it("does not link the item when the view has no detail page", () => {
      // Act
      const breadcrumbs = build(
        `/dashboard/mediapulse/tickers/${ITEM_ID}/edit`,
      );

      // Assert
      expect(breadcrumbs).toEqual([
        { label: "Mediapulse" },
        { label: "Tickers", href: "/dashboard/mediapulse/tickers" },
        { label: "Detail" },
        { label: "Edit" },
      ]);
    });

    it("does not link items of content views", () => {
      // Act
      const breadcrumbs = build(`/dashboard/mediapulse/report/${ITEM_ID}/edit`);

      // Assert
      expect(breadcrumbs[2]).toEqual({ label: "Detail" });
    });

    it("humanizes unknown item sub pages and trailing segments", () => {
      // Act
      const breadcrumbs = build(
        `/dashboard/mediapulse/articles/${ITEM_ID}/raw-json/latest`,
      );

      // Assert
      expect(breadcrumbs.slice(-2)).toEqual([
        { label: "Raw json" },
        { label: "Latest" },
      ]);
    });

    it("humanizes segments while integrations are still loading", () => {
      // Act
      const breadcrumbs = buildDashboardBreadcrumbs({
        pathname: "/dashboard/mediapulse/search-queries",
        domainIntegrations: [],
      });

      // Assert
      expect(breadcrumbs).toEqual([
        { label: "Mediapulse" },
        { label: "Search queries" },
      ]);
    });

    it("humanizes a view the integration does not declare", () => {
      // Assert
      expect(build("/dashboard/mediapulse/entity_types")).toEqual([
        { label: "Mediapulse" },
        { label: "Entity types" },
      ]);
    });

    it("looks up entity labels by the decoded segment and keeps the encoded href", () => {
      // Setup
      const entityLabels = new Map([["BBCA JK", "Bank Central Asia"]]);

      // Act
      const breadcrumbs = build(
        "/dashboard/mediapulse/articles/BBCA%20JK/edit",
        entityLabels,
      );

      // Assert
      expect(breadcrumbs[2]).toEqual({
        label: "Bank Central Asia",
        href: "/dashboard/mediapulse/articles/BBCA%20JK",
      });
    });

    it("tolerates malformed percent encoding", () => {
      // Act
      const breadcrumbs = build("/dashboard/mediapulse/bad%E0%A4%A");

      // Assert
      expect(breadcrumbs.at(-1)).toEqual({ label: "Bad%E0%A4%A" });
    });

    it("treats object prototype keys as ordinary segments", () => {
      // Assert
      expect(build("/dashboard/constructor/toString")).toEqual([
        { label: "Constructor" },
        { label: "ToString" },
      ]);
    });
  });
});
