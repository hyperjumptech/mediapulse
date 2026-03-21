import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  entityTypesDashboardPage,
  entityTypesHermesPathSegment,
} from "./dashboard-page";
import { entityTypesRoutes } from "./routes";

/**
 * Hermes dashboard registration for the entity types resource (routes + manifest page).
 */
export const entityTypesHermesDashboardResource = defineHermesDashboardResource(
  {
    resourceKey: "entityTypes",
    pathSegment: entityTypesHermesPathSegment,
    order: 20,
    routes: entityTypesRoutes,
    dashboardPage: entityTypesDashboardPage,
  },
);
