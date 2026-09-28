import type { DashboardView } from "@hermes/domain-contract";
import {
  Bot,
  Calendar,
  FileJson,
  FileText,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Plug,
  Radio,
  Users,
  Variable,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type DashboardNavGroup = {
  label: string;
  items: DashboardNavItem[];
};

export type DomainIntegrationNav = {
  integrationId: string;
  name: string;
  views: DashboardView[];
};

export type DashboardBreadcrumb = {
  label: string;
  href?: string;
};

export type DashboardEntityLabels = ReadonlyMap<string, string>;

export type BuildDashboardBreadcrumbsInput = {
  pathname: string | null;
  domainIntegrations: readonly DomainIntegrationNav[];
  entityLabels?: DashboardEntityLabels;
};

type HermesSectionEntity = {
  label: string;
  hasDetailPage: boolean;
};

export const DASHBOARD_ROOT_PATH = "/dashboard";

const OVERVIEW_LABEL = "Overview";
const DASHBOARD_ROOT_SEGMENT = "dashboard";
const DASHBOARD_SECTION_PREFIX = `${DASHBOARD_ROOT_PATH}/`;
const NEW_LABEL = "New";
const EDIT_LABEL = "Edit";
const EDIT_SEGMENT = "edit";
const EXECUTIONS_SEGMENT = "executions";
const EXECUTION_LABEL = "Execution";
const DOMAIN_ITEM_LABEL = "Detail";
const DOMAIN_ITEM_NEW_SEGMENT = "new";
const HERMES_CREATE_SEGMENTS = new Set(["new", "create"]);

export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    label: "Home",
    items: [
      {
        href: DASHBOARD_ROOT_PATH,
        label: OVERVIEW_LABEL,
        icon: LayoutDashboard,
      },
      { href: "/dashboard/pipelines", label: "Pipelines", icon: GitBranch },
      { href: "/dashboard/schedules", label: "Schedules", icon: Calendar },
      { href: "/dashboard/http-triggers", label: "HTTP triggers", icon: Radio },
    ],
  },
  {
    label: "Agents",
    items: [
      { href: "/dashboard/agents", label: "Agents", icon: Bot },
      {
        href: "/dashboard/agent-configs",
        label: "Agent configs",
        icon: FileJson,
      },
      {
        href: "/dashboard/agent-contracts",
        label: "Agent contracts",
        icon: FileText,
      },
      { href: "/dashboard/variables", label: "Variables", icon: Variable },
    ],
  },
];

export const dashboardSecondaryNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard/domain-integrations",
    label: "Domain integrations",
    icon: Plug,
  },
  { href: "/dashboard/api-keys", label: "API keys", icon: KeyRound },
  { href: "/dashboard/admins", label: "Admins", icon: Users },
];

export const dashboardNavItems: DashboardNavItem[] = [
  ...dashboardNavGroups.flatMap((group) => group.items),
  ...dashboardSecondaryNavItems,
];

export type DashboardQuickCreateItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const CREATE_QUERY_PARAM = "create";

export const dashboardQuickCreateItems: DashboardQuickCreateItem[] = [
  {
    href: `/dashboard/pipelines?${CREATE_QUERY_PARAM}=1`,
    label: "Pipeline",
    icon: GitBranch,
  },
  {
    href: `/dashboard/schedules?${CREATE_QUERY_PARAM}=1`,
    label: "Schedule",
    icon: Calendar,
  },
  {
    href: `/dashboard/http-triggers?${CREATE_QUERY_PARAM}=1`,
    label: "HTTP trigger",
    icon: Radio,
  },
  {
    href: "/dashboard/agent-configs/new",
    label: "Agent config",
    icon: FileJson,
  },
];

export type DashboardPrimaryAction = {
  href: string;
  label: string;
};

const createOnPage = (path: string) => `${path}?${CREATE_QUERY_PARAM}=1`;

const dashboardPrimaryActions = new Map<string, DashboardPrimaryAction>([
  [
    "/dashboard/pipelines",
    { href: createOnPage("/dashboard/pipelines"), label: "New pipeline" },
  ],
  [
    "/dashboard/schedules",
    { href: createOnPage("/dashboard/schedules"), label: "New schedule" },
  ],
  [
    "/dashboard/http-triggers",
    {
      href: createOnPage("/dashboard/http-triggers"),
      label: "New HTTP trigger",
    },
  ],
  [
    "/dashboard/agent-configs",
    { href: "/dashboard/agent-configs/new", label: "Add config" },
  ],
  [
    "/dashboard/agent-contracts",
    { href: createOnPage("/dashboard/agent-contracts"), label: "Add contract" },
  ],
  [
    "/dashboard/variables",
    { href: createOnPage("/dashboard/variables"), label: "Add variable" },
  ],
  [
    "/dashboard/domain-integrations",
    {
      href: "/dashboard/domain-integrations/create",
      label: "New integration",
    },
  ],
  [
    "/dashboard/api-keys",
    { href: createOnPage("/dashboard/api-keys"), label: "Create API key" },
  ],
  [
    "/dashboard/admins",
    { href: createOnPage("/dashboard/admins"), label: "Add admin" },
  ],
]);

const hermesSectionLabels = new Map<string, string>(
  dashboardNavItems
    .filter((item) => item.href.startsWith(DASHBOARD_SECTION_PREFIX))
    .map((item): [string, string] => {
      const section = item.href.slice(DASHBOARD_SECTION_PREFIX.length);

      return [section, item.label];
    }),
);

const hermesSectionEntities = new Map<string, HermesSectionEntity>([
  ["pipelines", { label: "Pipeline", hasDetailPage: true }],
  ["schedules", { label: "Schedule", hasDetailPage: true }],
  ["http-triggers", { label: "HTTP trigger", hasDetailPage: true }],
  ["agents", { label: "Agent", hasDetailPage: true }],
  ["agent-configs", { label: "Agent config", hasDetailPage: false }],
  ["agent-contracts", { label: "Agent contract", hasDetailPage: false }],
  ["variables", { label: "Variable", hasDetailPage: false }],
  [
    "domain-integrations",
    { label: "Domain integration", hasDetailPage: false },
  ],
  ["api-keys", { label: "API key", hasDetailPage: false }],
  ["admins", { label: "Admin", hasDetailPage: false }],
]);

const fallbackSectionEntity: HermesSectionEntity = {
  label: DOMAIN_ITEM_LABEL,
  hasDetailPage: false,
};

const executionSubPageLabels = new Map<string, string>([
  ["processed-urls", "Processed URLs"],
]);

const noEntityLabels: DashboardEntityLabels = new Map();

export const isDashboardPathActive = (
  pathname: string | null,
  href: string,
): boolean => {
  if (!pathname) {
    return false;
  }

  if (href === DASHBOARD_ROOT_PATH) {
    return pathname === DASHBOARD_ROOT_PATH;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export const buildDomainIntegrationViewHref = (
  integrationId: string,
  view: Pick<DashboardView, "id" | "pathSegment">,
): string => {
  const pathSegment = view.pathSegment ?? view.id;

  return `${DASHBOARD_ROOT_PATH}/${integrationId}/${pathSegment}`;
};

const decodePathSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const hasCreateSchemaProperties = (
  createSchema: Record<string, unknown> | undefined,
): boolean => {
  const properties = createSchema?.properties;
  if (typeof properties !== "object" || properties === null) {
    return false;
  }

  return Object.keys(properties).length > 0;
};

export const resolveDomainViewPrimaryAction = (
  pathname: string | null,
  domainIntegrations: readonly DomainIntegrationNav[],
): DashboardPrimaryAction | null => {
  const segments = (pathname ?? "").split("/").filter(Boolean);
  const [rootSegment, integrationSegment, resourceSegment, ...rest] = segments;
  if (
    rootSegment !== DASHBOARD_ROOT_SEGMENT ||
    !integrationSegment ||
    !resourceSegment ||
    rest.length > 0 ||
    hermesSectionLabels.has(integrationSegment)
  ) {
    return null;
  }
  const integrationId = decodePathSegment(integrationSegment);
  const resource = decodePathSegment(resourceSegment);
  const integration = domainIntegrations.find(
    (candidate) => candidate.integrationId === integrationId,
  );
  const view = integration?.views.find(
    (candidate) => candidate.pathSegment === resource,
  );
  if (
    view?.kind !== "resource-table" ||
    !view.actions.create ||
    !hasCreateSchemaProperties(view.createSchema)
  ) {
    return null;
  }
  const basePath = `${DASHBOARD_ROOT_PATH}/${integrationSegment}/${resourceSegment}`;
  const href =
    view.createNavigation === "full-page"
      ? `${basePath}/${DOMAIN_ITEM_NEW_SEGMENT}`
      : createOnPage(basePath);

  return { href, label: `Add ${view.label}` };
};

export const resolveDashboardPrimaryAction = (
  pathname: string | null,
  domainIntegrations: readonly DomainIntegrationNav[] = [],
): DashboardPrimaryAction | null => {
  if (!pathname) {
    return null;
  }

  return (
    dashboardPrimaryActions.get(pathname) ??
    resolveDomainViewPrimaryAction(pathname, domainIntegrations)
  );
};

const humanizePathSegment = (segment: string): string => {
  const words = decodePathSegment(segment).replace(/[-_]+/g, " ").trim();
  const firstLetter = words.charAt(0).toUpperCase();

  return `${firstLetter}${words.slice(1)}`;
};

const createBreadcrumb = (label: string, href?: string): DashboardBreadcrumb =>
  href ? { label, href } : { label };

const humanizeTrailingSegments = (
  segments: readonly string[],
): DashboardBreadcrumb[] =>
  segments.map((segment) => createBreadcrumb(humanizePathSegment(segment)));

const resolveEntityLabel = (
  entityLabels: DashboardEntityLabels,
  segment: string,
  fallbackLabel: string,
): string => entityLabels.get(decodePathSegment(segment)) ?? fallbackLabel;

const toCurrentPageTrail = (
  breadcrumbs: DashboardBreadcrumb[],
): DashboardBreadcrumb[] => {
  const lastIndex = breadcrumbs.length - 1;

  return breadcrumbs.map((breadcrumb, index) =>
    index === lastIndex ? createBreadcrumb(breadcrumb.label) : breadcrumb,
  );
};

const buildExecutionTrail = (
  entityPath: string,
  executionId: string,
  executionRest: readonly string[],
  entityLabels: DashboardEntityLabels,
): DashboardBreadcrumb[] => {
  const executionPath = `${entityPath}/${EXECUTIONS_SEGMENT}/${executionId}`;
  const executionLabel = resolveEntityLabel(
    entityLabels,
    executionId,
    EXECUTION_LABEL,
  );
  const executionBreadcrumb = createBreadcrumb(executionLabel, executionPath);
  const subPageBreadcrumbs = executionRest.map((segment) => {
    const subPageLabel =
      executionSubPageLabels.get(segment) ?? humanizePathSegment(segment);

    return createBreadcrumb(subPageLabel);
  });

  return [executionBreadcrumb, ...subPageBreadcrumbs];
};

const buildHermesEntityTrail = (
  section: string,
  entityId: string,
  entityRest: readonly string[],
  entityLabels: DashboardEntityLabels,
): DashboardBreadcrumb[] => {
  const sectionEntity =
    hermesSectionEntities.get(section) ?? fallbackSectionEntity;
  const entityPath = `${DASHBOARD_ROOT_PATH}/${section}/${entityId}`;
  const entityLabel = resolveEntityLabel(
    entityLabels,
    entityId,
    sectionEntity.label,
  );
  const entityHref = sectionEntity.hasDetailPage ? entityPath : undefined;
  const entityBreadcrumb = createBreadcrumb(entityLabel, entityHref);
  const [entitySubPage, executionId, ...executionRest] = entityRest;

  if (!entitySubPage) {
    return [entityBreadcrumb];
  }

  if (entitySubPage === EDIT_SEGMENT) {
    return [entityBreadcrumb, createBreadcrumb(EDIT_LABEL)];
  }

  if (entitySubPage === EXECUTIONS_SEGMENT && executionId) {
    const executionTrail = buildExecutionTrail(
      entityPath,
      executionId,
      executionRest,
      entityLabels,
    );

    return [entityBreadcrumb, ...executionTrail];
  }

  return [entityBreadcrumb, ...humanizeTrailingSegments(entityRest)];
};

const buildHermesSectionTrail = (
  section: string,
  sectionLabel: string,
  sectionRest: readonly string[],
  entityLabels: DashboardEntityLabels,
): DashboardBreadcrumb[] => {
  const sectionBreadcrumb = createBreadcrumb(
    sectionLabel,
    `${DASHBOARD_ROOT_PATH}/${section}`,
  );
  const [subSegment, ...subRest] = sectionRest;

  if (!subSegment) {
    return [sectionBreadcrumb];
  }

  if (HERMES_CREATE_SEGMENTS.has(subSegment)) {
    return [sectionBreadcrumb, createBreadcrumb(NEW_LABEL)];
  }

  const entityTrail = buildHermesEntityTrail(
    section,
    subSegment,
    subRest,
    entityLabels,
  );

  return [sectionBreadcrumb, ...entityTrail];
};

const hasDomainItemDetailPage = (view: DashboardView | undefined): boolean =>
  view?.kind === "resource-table" && view.actions.view;

const buildDomainIntegrationTrail = (
  integrationId: string,
  integrationRest: readonly string[],
  domainIntegrations: readonly DomainIntegrationNav[],
  entityLabels: DashboardEntityLabels,
): DashboardBreadcrumb[] => {
  const decodedIntegrationId = decodePathSegment(integrationId);
  const integration = domainIntegrations.find(
    (candidate) => candidate.integrationId === decodedIntegrationId,
  );
  const integrationLabel =
    integration?.name ?? humanizePathSegment(integrationId);
  const integrationBreadcrumb = createBreadcrumb(integrationLabel);
  const [resource, itemSegment, itemSubPage, ...itemRest] = integrationRest;

  if (!resource) {
    return [integrationBreadcrumb];
  }

  const decodedResource = decodePathSegment(resource);
  const view = integration?.views.find(
    (candidate) => candidate.pathSegment === decodedResource,
  );
  const resourcePath = `${DASHBOARD_ROOT_PATH}/${integrationId}/${resource}`;
  const resourceLabel = view?.label ?? humanizePathSegment(resource);
  const resourceBreadcrumb = createBreadcrumb(resourceLabel, resourcePath);
  const resourceTrail = [integrationBreadcrumb, resourceBreadcrumb];

  if (!itemSegment) {
    return resourceTrail;
  }

  if (itemSegment === DOMAIN_ITEM_NEW_SEGMENT) {
    return [...resourceTrail, createBreadcrumb(NEW_LABEL)];
  }

  const itemLabel = resolveEntityLabel(
    entityLabels,
    itemSegment,
    DOMAIN_ITEM_LABEL,
  );
  const itemHref = hasDomainItemDetailPage(view)
    ? `${resourcePath}/${itemSegment}`
    : undefined;
  const itemBreadcrumb = createBreadcrumb(itemLabel, itemHref);

  if (!itemSubPage) {
    return [...resourceTrail, itemBreadcrumb];
  }

  const itemSubPageLabel =
    itemSubPage === EDIT_SEGMENT
      ? EDIT_LABEL
      : humanizePathSegment(itemSubPage);

  return [
    ...resourceTrail,
    itemBreadcrumb,
    createBreadcrumb(itemSubPageLabel),
    ...humanizeTrailingSegments(itemRest),
  ];
};

export const buildDashboardBreadcrumbs = ({
  pathname,
  domainIntegrations,
  entityLabels = noEntityLabels,
}: BuildDashboardBreadcrumbsInput): DashboardBreadcrumb[] => {
  const segments = (pathname ?? "").split("/").filter(Boolean);
  const [rootSegment, section, ...sectionRest] = segments;

  if (rootSegment !== DASHBOARD_ROOT_SEGMENT || !section) {
    return [createBreadcrumb(OVERVIEW_LABEL)];
  }

  const sectionLabel = hermesSectionLabels.get(section);
  const trail = sectionLabel
    ? buildHermesSectionTrail(section, sectionLabel, sectionRest, entityLabels)
    : buildDomainIntegrationTrail(
        section,
        sectionRest,
        domainIntegrations,
        entityLabels,
      );

  return toCurrentPageTrail(trail);
};

export type DashboardPageTitle = {
  title: string;
  parent: DashboardBreadcrumb | null;
};

export const resolveDashboardPageTitle = (
  breadcrumbs: readonly DashboardBreadcrumb[],
): DashboardPageTitle => {
  const current = breadcrumbs.at(-1);
  const parent = breadcrumbs.at(-2) ?? null;

  return { title: current?.label ?? OVERVIEW_LABEL, parent };
};
