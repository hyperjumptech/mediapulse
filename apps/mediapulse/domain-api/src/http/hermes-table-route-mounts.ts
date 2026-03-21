import type { Hono } from "hono";
import {
  HermesDashboardResource,
  type HermesDashboardSegment,
} from "../hermes-dashboard/paths";
import { dataSourceExpansionsRoutes } from "../resources/data-source-expansions/routes";
import { entityTypesRoutes } from "../resources/entity-types/routes";
import { mediapulseUsersRoutes } from "../resources/mediapulse-users/routes";
import { relationTypesRoutes } from "../resources/relation-types/routes";
import { searchQueriesRoutes } from "../resources/search-queries/routes";
import { tickersRoutes } from "../resources/tickers/routes";

/**
 * Hermes `table-v1` resources: each entry must match a manifest page and a mounted sub-app.
 * Order matches manifest `order` for readability only; Hono does not depend on it.
 */
export const hermesDashboardTableRouteMounts: ReadonlyArray<{
  segment: HermesDashboardSegment;
  app: Hono;
}> = [
  { segment: HermesDashboardResource.tickers, app: tickersRoutes },
  {
    segment: HermesDashboardResource.mediapulseUsers,
    app: mediapulseUsersRoutes,
  },
  { segment: HermesDashboardResource.entityTypes, app: entityTypesRoutes },
  { segment: HermesDashboardResource.relationTypes, app: relationTypesRoutes },
  { segment: HermesDashboardResource.searchQueries, app: searchQueriesRoutes },
  {
    segment: HermesDashboardResource.dataSourceExpansions,
    app: dataSourceExpansionsRoutes,
  },
];
