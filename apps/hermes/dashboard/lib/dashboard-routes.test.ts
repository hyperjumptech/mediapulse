import { describe, expect, it } from "vitest";
import type { DashboardView, ResourceTableView } from "@hermes/domain-contract";

import {
  buildDashboardBreadcrumbs,
  buildDomainIntegrationViewHref,
  dashboardNavGroups,
  dashboardNavItems,
  dashboardQuickCreateItems,
  dashboardSecondaryNavItems,
  resolveDashboardPageTitle,
  resolveDashboardPrimaryAction,
  resolveDomainViewPrimaryAction,
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
    const groupSummaries = dashboardNavGroups.map((group) => ({
      label: group.label,
      items: group.items.map((item) => item.label),
    }));

    expect(groupSummaries).toEqual([
      {
        label: "Home",
        items: ["Overview", "Pipelines", "Schedules", "HTTP triggers"],
      },
      {
        label: "Agents",
        items: ["Agents", "Agent configs", "Agent contracts", "Variables"],
      },
    ]);
    expect(dashboardSecondaryNavItems.map((item) => item.label)).toEqual([
      "Domain integrations",
      "API keys",
      "Admins",
    ]);
  });

  it("gives every item a dashboard href and an icon", () => {
    const items = dashboardNavItems;

    for (const item of items) {
      expect(item.href.startsWith("/dashboard")).toBe(true);
      expect(item.icon).toBeTruthy();
    }
  });
});

describe("isDashboardPathActive", () => {
  it("matches the dashboard root only on an exact path", () => {
    expect(isDashboardPathActive("/dashboard", "/dashboard")).toBe(true);
    expect(isDashboardPathActive("/dashboard/pipelines", "/dashboard")).toBe(
      false,
    );
  });

  it("matches a section and its nested routes", () => {
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
    expect(
      isDashboardPathActive("/dashboard/agent-configs", "/dashboard/agent"),
    ).toBe(false);
    expect(
      isDashboardPathActive("/dashboard/agents-archive", "/dashboard/agents"),
    ).toBe(false);
  });

  it("returns false without a pathname", () => {
    expect(isDashboardPathActive(null, "/dashboard")).toBe(false);
  });
});

describe("buildDomainIntegrationViewHref", () => {
  it("uses the view path segment", () => {
    const href = buildDomainIntegrationViewHref("mediapulse", {
      id: "tickers-view",
      pathSegment: "tickers",
    });

    expect(href).toBe("/dashboard/mediapulse/tickers");
  });

  it("falls back to the view id when the path segment is missing", () => {
    const href = buildDomainIntegrationViewHref("mediapulse", {
      id: "tickers",
      pathSegment: undefined,
    });

    expect(href).toBe("/dashboard/mediapulse/tickers");
  });
});

describe("buildDashboardBreadcrumbs", () => {
  describe("dashboard root", () => {
    it("returns Overview for /dashboard", () => {
      expect(build("/dashboard")).toEqual([{ label: "Overview" }]);
    });

    it("returns Overview for a missing pathname", () => {
      expect(build(null)).toEqual([{ label: "Overview" }]);
    });

    it("returns Overview for a path outside the dashboard", () => {
      expect(build("/login")).toEqual([{ label: "Overview" }]);
    });
  });

  describe("Hermes sections", () => {
    it("returns the section label for a section index", () => {
      expect(build("/dashboard/pipelines")).toEqual([{ label: "Pipelines" }]);
      expect(build("/dashboard/http-triggers")).toEqual([
        { label: "HTTP triggers" },
      ]);
      expect(build("/dashboard/api-keys")).toEqual([{ label: "API keys" }]);
    });

    it("ignores a trailing slash", () => {
      expect(build("/dashboard/schedules/")).toEqual([{ label: "Schedules" }]);
    });

    it("never gives the current page an href", () => {
      const breadcrumbs = build(`/dashboard/pipelines/${PIPELINE_ID}`);
      const currentPage = breadcrumbs.at(-1);

      expect(currentPage).not.toHaveProperty("href");
    });
  });

  describe("entity detail pages", () => {
    it("falls back to the entity noun without a registered label", () => {
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
      const entityLabels = new Map([[PIPELINE_ID, "Nightly ingest"]]);

      const breadcrumbs = build(
        `/dashboard/pipelines/${PIPELINE_ID}`,
        entityLabels,
      );

      expect(breadcrumbs).toEqual([
        { label: "Pipelines", href: "/dashboard/pipelines" },
        { label: "Nightly ingest" },
      ]);
    });

    it("labels unknown trailing segments by humanizing them", () => {
      expect(build(`/dashboard/schedules/${SCHEDULE_ID}/executions`)).toEqual([
        { label: "Schedules", href: "/dashboard/schedules" },
        { label: "Schedule", href: `/dashboard/schedules/${SCHEDULE_ID}` },
        { label: "Executions" },
      ]);
    });
  });

  describe("execution pages", () => {
    it("links the schedule and ends on the execution", () => {
      const entityLabels = new Map([[SCHEDULE_ID, "Morning run"]]);

      const breadcrumbs = build(
        `/dashboard/schedules/${SCHEDULE_ID}/executions/${EXECUTION_ID}`,
        entityLabels,
      );

      expect(breadcrumbs).toEqual([
        { label: "Schedules", href: "/dashboard/schedules" },
        { label: "Morning run", href: `/dashboard/schedules/${SCHEDULE_ID}` },
        { label: "Execution" },
      ]);
    });

    it("falls back to the schedule noun without a registered label", () => {
      const breadcrumbs = build(
        `/dashboard/schedules/${SCHEDULE_ID}/executions/${EXECUTION_ID}`,
      );

      expect(breadcrumbs).toEqual([
        { label: "Schedules", href: "/dashboard/schedules" },
        { label: "Schedule", href: `/dashboard/schedules/${SCHEDULE_ID}` },
        { label: "Execution" },
      ]);
    });

    it("adds Processed URLs after a linked execution", () => {
      const breadcrumbs = build(
        `/dashboard/schedules/${SCHEDULE_ID}/executions/${EXECUTION_ID}/processed-urls`,
      );

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
      const entityLabels = new Map([[EXECUTION_ID, "Run #42"]]);

      const breadcrumbs = build(
        `/dashboard/pipelines/${PIPELINE_ID}/executions/${EXECUTION_ID}`,
        entityLabels,
      );

      expect(breadcrumbs.at(-1)).toEqual({ label: "Run #42" });
    });
  });

  describe("create and edit pages", () => {
    it("labels agent config creation as New", () => {
      expect(build("/dashboard/agent-configs/new")).toEqual([
        { label: "Agent configs", href: "/dashboard/agent-configs" },
        { label: "New" },
      ]);
    });

    it("does not link an agent config that has no detail page", () => {
      expect(build("/dashboard/agent-configs/config-1/edit")).toEqual([
        { label: "Agent configs", href: "/dashboard/agent-configs" },
        { label: "Agent config" },
        { label: "Edit" },
      ]);
    });

    it("uses the registered agent config label on the edit page", () => {
      const entityLabels = new Map([["config-1", "Default summarizer"]]);

      const breadcrumbs = build(
        "/dashboard/agent-configs/config-1/edit",
        entityLabels,
      );

      expect(breadcrumbs).toEqual([
        { label: "Agent configs", href: "/dashboard/agent-configs" },
        { label: "Default summarizer" },
        { label: "Edit" },
      ]);
    });

    it("labels domain integration creation as New", () => {
      expect(build("/dashboard/domain-integrations/create")).toEqual([
        {
          label: "Domain integrations",
          href: "/dashboard/domain-integrations",
        },
        { label: "New" },
      ]);
    });
  });

  describe("domain integration pages", () => {
    it("shows the integration name and view label", () => {
      expect(build("/dashboard/mediapulse/tickers")).toEqual([
        { label: "Mediapulse" },
        { label: "Tickers" },
      ]);
    });

    it("shows only the integration name at the integration root", () => {
      expect(build("/dashboard/mediapulse")).toEqual([{ label: "Mediapulse" }]);
    });

    it("labels item creation as New", () => {
      expect(build("/dashboard/mediapulse/tickers/new")).toEqual([
        { label: "Mediapulse" },
        { label: "Tickers", href: "/dashboard/mediapulse/tickers" },
        { label: "New" },
      ]);
    });

    it("falls back to Detail for an item without a registered label", () => {
      expect(build(`/dashboard/mediapulse/articles/${ITEM_ID}`)).toEqual([
        { label: "Mediapulse" },
        { label: "Articles", href: "/dashboard/mediapulse/articles" },
        { label: "Detail" },
      ]);
    });

    it("links the item on its edit page when the view has a detail page", () => {
      const entityLabels = new Map([[ITEM_ID, "Rate cut coverage"]]);

      const breadcrumbs = build(
        `/dashboard/mediapulse/articles/${ITEM_ID}/edit`,
        entityLabels,
      );

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
      const breadcrumbs = build(
        `/dashboard/mediapulse/tickers/${ITEM_ID}/edit`,
      );

      expect(breadcrumbs).toEqual([
        { label: "Mediapulse" },
        { label: "Tickers", href: "/dashboard/mediapulse/tickers" },
        { label: "Detail" },
        { label: "Edit" },
      ]);
    });

    it("does not link items of content views", () => {
      const breadcrumbs = build(`/dashboard/mediapulse/report/${ITEM_ID}/edit`);

      expect(breadcrumbs[2]).toEqual({ label: "Detail" });
    });

    it("humanizes unknown item sub pages and trailing segments", () => {
      const breadcrumbs = build(
        `/dashboard/mediapulse/articles/${ITEM_ID}/raw-json/latest`,
      );

      expect(breadcrumbs.slice(-2)).toEqual([
        { label: "Raw json" },
        { label: "Latest" },
      ]);
    });

    it("humanizes segments while integrations are still loading", () => {
      const breadcrumbs = buildDashboardBreadcrumbs({
        pathname: "/dashboard/mediapulse/search-queries",
        domainIntegrations: [],
      });

      expect(breadcrumbs).toEqual([
        { label: "Mediapulse" },
        { label: "Search queries" },
      ]);
    });

    it("humanizes a view the integration does not declare", () => {
      expect(build("/dashboard/mediapulse/entity_types")).toEqual([
        { label: "Mediapulse" },
        { label: "Entity types" },
      ]);
    });

    it("looks up entity labels by the decoded segment and keeps the encoded href", () => {
      const entityLabels = new Map([["BBCA JK", "Bank Central Asia"]]);

      const breadcrumbs = build(
        "/dashboard/mediapulse/articles/BBCA%20JK/edit",
        entityLabels,
      );

      expect(breadcrumbs[2]).toEqual({
        label: "Bank Central Asia",
        href: "/dashboard/mediapulse/articles/BBCA%20JK",
      });
    });

    it("tolerates malformed percent encoding", () => {
      const breadcrumbs = build("/dashboard/mediapulse/bad%E0%A4%A");

      expect(breadcrumbs.at(-1)).toEqual({ label: "Bad%E0%A4%A" });
    });

    it("treats object prototype keys as ordinary segments", () => {
      expect(build("/dashboard/constructor/toString")).toEqual([
        { label: "Constructor" },
        { label: "ToString" },
      ]);
    });
  });
});

describe("dashboardQuickCreateItems", () => {
  it("opens the create form of each list page", () => {
    expect(dashboardQuickCreateItems.map((item) => item.href)).toEqual([
      "/dashboard/pipelines?create=1",
      "/dashboard/schedules?create=1",
      "/dashboard/http-triggers?create=1",
      "/dashboard/agent-configs/new",
    ]);
  });
});

describe("resolveDashboardPageTitle", () => {
  it("uses the last crumb as the title and the one before as the parent", () => {
    const pageTitle = resolveDashboardPageTitle([
      { label: "Pipelines", href: "/dashboard/pipelines" },
      { label: "Daily ingest" },
    ]);

    expect(pageTitle).toEqual({
      title: "Daily ingest",
      parent: { label: "Pipelines", href: "/dashboard/pipelines" },
    });
  });

  it("has no parent on a top-level page", () => {
    expect(resolveDashboardPageTitle([{ label: "Schedules" }])).toEqual({
      title: "Schedules",
      parent: null,
    });
  });

  it("falls back to Overview without crumbs", () => {
    expect(resolveDashboardPageTitle([])).toEqual({
      title: "Overview",
      parent: null,
    });
  });
});

describe("resolveDomainViewPrimaryAction", () => {
  const createSchema = {
    type: "object",
    properties: { symbol: { type: "string" } },
  };

  const integrationWith = (
    overrides: Partial<ResourceTableView>,
  ): DomainIntegrationNav[] => [
    {
      integrationId: "acme",
      name: "Acme",
      views: [
        {
          ...createResourceTableView("items", "Items", true),
          createSchema,
          ...overrides,
        },
        reportView,
      ],
    },
  ];

  it("opens the create dialog on the list page for a modal view", () => {
    const action = resolveDomainViewPrimaryAction(
      "/dashboard/acme/items",
      integrationWith({}),
    );

    expect(action).toEqual({
      href: "/dashboard/acme/items?create=1",
      label: "Add Items",
    });
  });

  it("links to the new page for a full-page view", () => {
    const action = resolveDomainViewPrimaryAction(
      "/dashboard/acme/items/",
      integrationWith({ createNavigation: "full-page" }),
    );

    expect(action).toEqual({
      href: "/dashboard/acme/items/new",
      label: "Add Items",
    });
  });

  it("keeps the encoded path segments in the href", () => {
    const integrations: DomainIntegrationNav[] = [
      {
        integrationId: "acme corp",
        name: "Acme",
        views: [
          {
            ...createResourceTableView("price lists", "Price lists", false),
            createSchema,
          },
        ],
      },
    ];

    const action = resolveDomainViewPrimaryAction(
      "/dashboard/acme%20corp/price%20lists",
      integrations,
    );

    expect(action?.href).toBe("/dashboard/acme%20corp/price%20lists?create=1");
  });

  it.each([
    {
      name: "cannot create",
      overrides: {
        actions: { create: false, update: true, delete: true, view: true },
      },
    },
    { name: "has no create schema", overrides: { createSchema: undefined } },
    {
      name: "has an empty create schema",
      overrides: { createSchema: { type: "object", properties: {} } },
    },
    {
      name: "has create schema properties that are not an object",
      overrides: { createSchema: { type: "object", properties: "symbol" } },
    },
  ])("returns null when the view $name", ({ overrides }) => {
    const action = resolveDomainViewPrimaryAction(
      "/dashboard/acme/items",
      integrationWith(overrides),
    );

    expect(action).toBeNull();
  });

  it.each([
    { name: "a content view", pathname: "/dashboard/acme/report" },
    { name: "an unknown view", pathname: "/dashboard/acme/missing" },
    { name: "an unknown integration", pathname: "/dashboard/other/items" },
    { name: "an item page", pathname: "/dashboard/acme/items/item-1" },
    { name: "the new item page", pathname: "/dashboard/acme/items/new" },
    { name: "an item edit page", pathname: "/dashboard/acme/items/i-1/edit" },
    { name: "the integration root", pathname: "/dashboard/acme" },
    { name: "a Hermes detail page", pathname: "/dashboard/pipelines/items" },
    { name: "a path outside the dashboard", pathname: "/acme/items/x" },
  ])("returns null on $name", ({ pathname }) => {
    const action = resolveDomainViewPrimaryAction(
      pathname,
      integrationWith({}),
    );

    expect(action).toBeNull();
  });

  const updateSchema = {
    type: "object",
    properties: { title: { type: "string", title: "Title" } },
  };

  it("offers Edit on an item page when the view edits on a full page", () => {
    const action = resolveDomainViewPrimaryAction(
      "/dashboard/acme/items/row%201",
      integrationWith({ createNavigation: "full-page", updateSchema }),
    );

    expect(action).toEqual({
      href: "/dashboard/acme/items/row%201/edit",
      label: "Edit",
      intent: "edit",
    });
  });

  it.each([
    ["the editor is a modal", { createNavigation: "modal" as const }],
    [
      "updates are not allowed",
      { actions: { create: true, update: false, delete: true, view: true } },
    ],
    ["the update schema has no fields", { updateSchema: {} }],
  ])("offers no Edit when %s", (_reason, overrides) => {
    const action = resolveDomainViewPrimaryAction(
      "/dashboard/acme/items/row-1",
      integrationWith({
        createNavigation: "full-page",
        updateSchema,
        ...overrides,
      }),
    );

    expect(action).toBeNull();
  });

  it("returns null while integrations are still loading", () => {
    const action = resolveDomainViewPrimaryAction("/dashboard/acme/items", []);

    expect(action).toBeNull();
  });
});

describe("resolveDashboardPrimaryAction", () => {
  it("prefers the Hermes page action", () => {
    const action = resolveDashboardPrimaryAction("/dashboard/variables", []);

    expect(action).toEqual({
      href: "/dashboard/variables?create=1",
      label: "Add variable",
    });
  });

  it("falls back to the domain view action", () => {
    const integrations: DomainIntegrationNav[] = [
      {
        integrationId: "acme",
        name: "Acme",
        views: [
          {
            ...createResourceTableView("items", "Items", false),
            createSchema: { properties: { name: { type: "string" } } },
          },
        ],
      },
    ];

    const action = resolveDashboardPrimaryAction(
      "/dashboard/acme/items",
      integrations,
    );

    expect(action?.label).toBe("Add Items");
  });

  it("returns null without a pathname", () => {
    expect(resolveDashboardPrimaryAction(null)).toBeNull();
  });
});
