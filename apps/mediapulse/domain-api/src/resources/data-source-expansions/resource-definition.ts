import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  dataSourceExpansionsDashboardPage,
  dataSourceExpansionsHermesPathSegment,
} from "./dashboard-page";
import { dataSourceExpansionsRoutes } from "./routes";

/**
 * Hermes dashboard registration for the data-source expansions resource (routes + manifest page).
 */
export const dataSourceExpansionsHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "dataSourceExpansions",
    pathSegment: dataSourceExpansionsHermesPathSegment,
    order: 50,
    routes: dataSourceExpansionsRoutes,
    dashboardPage: dataSourceExpansionsDashboardPage,
  });
