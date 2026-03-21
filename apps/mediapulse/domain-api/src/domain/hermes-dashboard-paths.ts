/**
 * Canonical URL segments for the Mediapulse domain API Hermes dashboard integration.
 * Use these everywhere manifest `apiPrefix` / `pathSegment` and Hono mounts must stay aligned.
 */

/** Public prefix for versioned domain API routes (matches Hono `basePath`). */
export const DOMAIN_API_V1_PREFIX = "/v1";

const HERMES_DASHBOARD_SEGMENT = "hermes-dashboard";

/**
 * Path mounted on the v1 Hono instance (after `basePath("/v1")`), shared by all Hermes dashboard routes.
 */
export const HERMES_DASHBOARD_V1_MOUNT_PATH = `/${HERMES_DASHBOARD_SEGMENT}`;

/**
 * Table-v1 resource segments under `/v1/hermes-dashboard/<segment>`.
 * Keys are stable identifiers; values are the URL path segment (kebab-case).
 */
export const HermesDashboardResource = {
  tickers: "tickers",
  mediapulseUsers: "mediapulse-users",
  entityTypes: "entity-types",
  relationTypes: "relation-types",
  searchQueries: "search-queries",
  dataSourceExpansions: "data-source-expansions",
} as const;

export type HermesDashboardResourceKey = keyof typeof HermesDashboardResource;

export type HermesDashboardSegment =
  (typeof HermesDashboardResource)[HermesDashboardResourceKey];

/**
 * Returns the path to mount on the v1 app for a table-v1 resource, e.g. `/hermes-dashboard/tickers`.
 *
 * @param segment - Resource segment from {@link HermesDashboardResource}.
 */
export const hermesDashboardTableMountPath = (
  segment: HermesDashboardSegment,
): string => `${HERMES_DASHBOARD_V1_MOUNT_PATH}/${segment}`;

/**
 * Full `apiPrefix` advertised in the Hermes dashboard manifest (includes `/v1`).
 *
 * @param segment - Resource segment from {@link HermesDashboardResource}.
 */
export const hermesDashboardManifestApiPrefix = (
  segment: HermesDashboardSegment,
): string => `${DOMAIN_API_V1_PREFIX}/${HERMES_DASHBOARD_SEGMENT}/${segment}`;

/**
 * Step-input integration routes on the v1 API (expand / preview `db:` sources).
 */
export const STEP_INPUT_DOMAIN_API_PATHS = {
  previewExpansion: "/preview-expansion",
  expandStepInputs: "/expand-step-inputs",
} as const;
