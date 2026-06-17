import {
  dashboardPageSchema,
  type DashboardPage,
} from "@hermes/domain-contract";

/** Path segment for CGA diagnostics under `/dashboard/{integrationId}/`. */
export const CGA_DIAGNOSTICS_PATH_SEGMENT =
  "diagnostics/content-generation-runs" as const;

/** Path segment for section coverage under `/dashboard/{integrationId}/`. */
export const SECTION_COVERAGE_PATH_SEGMENT =
  "diagnostics/section-coverage" as const;

const operatorDiagnosticsNavDefaults = {
  template: "table-v1" as const,
  columns: [] as DashboardPage["columns"],
  searchableFields: [] as string[],
  sortableFields: [] as string[],
  actions: {
    create: false,
    update: false,
    delete: false,
    view: false,
  },
  customActions: [] as DashboardPage["customActions"],
  createNavigation: "full-page" as const,
};

/**
 * Synthetic manifest pages for operator diagnostics when `operator-diagnostics` is registered.
 *
 * @returns Nav entries merged into the integration sidebar (not table-v1 data pages).
 */
export const buildOperatorDiagnosticsNavPages = (): DashboardPage[] => [
  dashboardPageSchema.parse({
    id: "operator-section-coverage",
    label: "Section coverage",
    pathSegment: SECTION_COVERAGE_PATH_SEGMENT,
    apiPrefix: "/diagnostics/section-coverage",
    order: 910,
    ...operatorDiagnosticsNavDefaults,
  }),
  dashboardPageSchema.parse({
    id: "operator-cga-diagnostics",
    label: "CGA diagnostics",
    pathSegment: CGA_DIAGNOSTICS_PATH_SEGMENT,
    apiPrefix: "/diagnostics/content-generation-runs",
    order: 920,
    ...operatorDiagnosticsNavDefaults,
  }),
];
