/**
 * Wires the entity-relations Hono app and manifest page into the central `hermesDashboardResources` registry.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  entityRelationsDashboardPage,
  entityRelationsHermesPathSegment,
} from "./dashboard-page";
import { entityRelationsRoutes } from "./routes";

/**
 * Hermes dashboard registration for KG entity relations (routes + manifest page).
 */
export const entityRelationsHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "entityRelations",
    pathSegment: entityRelationsHermesPathSegment,
    order: 33,
    routes: entityRelationsRoutes,
    dashboardPage: entityRelationsDashboardPage,
  });
