import type { HermesDashboardSegment } from "./hermes-dashboard-resource-registry";
import {
  hermesDashboardManifestApiPrefix as hermesDashboardManifestApiPrefixImpl,
  hermesDashboardTableMountPath as hermesDashboardTableMountPathImpl,
} from "./hermes-dashboard-path-helpers";

export {
  DOMAIN_API_V1_PREFIX,
  HERMES_DASHBOARD_V1_MOUNT_PATH,
  STEP_INPUT_DOMAIN_API_PATHS,
} from "./hermes-dashboard-path-helpers";

export type {
  HermesDashboardResourceKey,
  HermesDashboardSegment,
} from "./hermes-dashboard-resource-registry";

export { HermesDashboardResource } from "./hermes-dashboard-resource-registry";

/**
 * Returns the path to mount on the v1 app for a dashboard resource, e.g. `/hermes-dashboard/tickers`.
 *
 * @param segment - Registered URL path segment from {@link HermesDashboardResource}.
 */
export const hermesDashboardTableMountPath = (
  segment: HermesDashboardSegment,
): string => hermesDashboardTableMountPathImpl(segment);

/**
 * Full `apiPrefix` advertised in the Hermes dashboard manifest (includes `/v1`).
 *
 * @param segment - Registered URL path segment from {@link HermesDashboardResource}.
 */
export const hermesDashboardManifestApiPrefix = (
  segment: HermesDashboardSegment,
): string => hermesDashboardManifestApiPrefixImpl(segment);
