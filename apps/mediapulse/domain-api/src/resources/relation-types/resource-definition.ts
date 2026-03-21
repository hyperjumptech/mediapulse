/**
 * Registers the relation-types routes and manifest page with `hermesDashboardResources`.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  relationTypesDashboardPage,
  relationTypesHermesPathSegment,
} from "./dashboard-page";
import { relationTypesRoutes } from "./routes";

/**
 * Hermes dashboard registration for the relation types resource (routes + manifest page).
 */
export const relationTypesHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "relationTypes",
    pathSegment: relationTypesHermesPathSegment,
    order: 30,
    routes: relationTypesRoutes,
    dashboardPage: relationTypesDashboardPage,
  });
