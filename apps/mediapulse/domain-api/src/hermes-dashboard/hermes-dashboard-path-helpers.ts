/**
 * URL helpers for the Mediapulse domain API Hermes dashboard integration.
 * Kept separate from {@link ./paths} so resource modules can import these without pulling in the resource registry (avoids circular imports).
 */

/** Public prefix for versioned domain API routes (matches Hono `basePath`). */
export const DOMAIN_API_V1_PREFIX = "/v1";

const HERMES_DASHBOARD_SEGMENT = "hermes-dashboard";

/**
 * Path mounted on the v1 Hono instance (after `basePath("/v1")`), shared by all Hermes dashboard routes.
 */
export const HERMES_DASHBOARD_V1_MOUNT_PATH = `/${HERMES_DASHBOARD_SEGMENT}`;

/**
 * Step-input integration routes on the v1 API (expand / preview `db:` sources).
 */
export const STEP_INPUT_DOMAIN_API_PATHS = {
  previewExpansion: "/preview-expansion",
  expandStepInputs: "/expand-step-inputs",
} as const;

/**
 * Returns the path to mount on the v1 app for a dashboard resource, e.g. `/hermes-dashboard/tickers`.
 *
 * @param segment - URL path segment (kebab-case), e.g. `"tickers"`.
 */
export const hermesDashboardTableMountPath = (segment: string): string =>
  `${HERMES_DASHBOARD_V1_MOUNT_PATH}/${segment}`;

/**
 * Full `apiPrefix` advertised in the Hermes dashboard manifest (includes `/v1`).
 *
 * @param segment - URL path segment (kebab-case), e.g. `"mediapulse-users"`.
 */
export const hermesDashboardManifestApiPrefix = (segment: string): string =>
  `${DOMAIN_API_V1_PREFIX}/${HERMES_DASHBOARD_SEGMENT}/${segment}`;
