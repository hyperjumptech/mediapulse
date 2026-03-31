/**
 * Registers data-sources (list + read-only detail) with the Hermes dashboard resource registry.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  dataSourcesDashboardPage,
  dataSourcesHermesPathSegment,
} from "./dashboard-page";
import { dataSourcesRoutes } from "./routes";

/**
 * Hermes dashboard registration for the data sources resource (routes + manifest page).
 */
export const dataSourcesHermesDashboardResource = defineHermesDashboardResource(
  {
    resourceKey: "dataSources",
    pathSegment: dataSourcesHermesPathSegment,
    order: 35,
    routes: dataSourcesRoutes,
    dashboardPage: dataSourcesDashboardPage,
  },
);
