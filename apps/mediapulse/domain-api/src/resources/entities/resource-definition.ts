/**
 * Wires the entities Hono app and manifest page into the central `hermesDashboardResources` registry.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  entitiesDashboardPage,
  entitiesHermesPathSegment,
} from "./dashboard-page";
import { entitiesRoutes } from "./routes";

/**
 * Hermes dashboard registration for canonical KG entities (routes + manifest page).
 */
export const entitiesHermesDashboardResource = defineHermesDashboardResource({
  resourceKey: "entities",
  pathSegment: entitiesHermesPathSegment,
  order: 32,
  routes: entitiesRoutes,
  dashboardPage: entitiesDashboardPage,
});
