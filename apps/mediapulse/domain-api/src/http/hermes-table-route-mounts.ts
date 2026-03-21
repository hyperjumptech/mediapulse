import type { Hono } from "hono";
import {
  HermesDashboardResource,
  type HermesDashboardSegment,
} from "../domain/hermes-dashboard-paths";
import { dataSourceExpansionsRoutes } from "./routes/data-source-expansions-routes";
import { entityTypesRoutes } from "./routes/entity-types-routes";
import { mediapulseUsersRoutes } from "./routes/mediapulse-users-routes";
import { relationTypesRoutes } from "./routes/relation-types-routes";
import { searchQueriesRoutes } from "./routes/search-queries-routes";
import { tickersRoutes } from "./routes/tickers-routes";

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
