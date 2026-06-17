/**
 * Wires the curated-sources Hono app and manifest page into the central `hermesDashboardResources` registry.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  curatedSourcesDashboardPage,
  curatedSourcesHermesPathSegment,
} from "./dashboard-page";
import { curatedSourcesRoutes } from "./routes";

/**
 * Hermes dashboard registration for the curated sources resource (routes + manifest page).
 */
export const curatedSourcesHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "curatedSources",
    pathSegment: curatedSourcesHermesPathSegment,
    order: 15,
    routes: curatedSourcesRoutes,
    dashboardPage: curatedSourcesDashboardPage,
  });
