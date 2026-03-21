import type { Hono } from "hono";
import {
  HermesDashboardResource,
  type HermesDashboardSegment,
} from "../hermes-dashboard/paths";
import { dataSourceExpansionsRoutes } from "../resources/data-source-expansions/tables/routes";
import { entityTypesRoutes } from "../resources/entity-types/tables/routes";
import { mediapulseUsersRoutes } from "../resources/mediapulse-users/tables/routes";
import { relationTypesRoutes } from "../resources/relation-types/tables/routes";
import { searchQueriesRoutes } from "../resources/search-queries/tables/routes";
import { tickersRoutes } from "../resources/tickers/tables/routes";

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
