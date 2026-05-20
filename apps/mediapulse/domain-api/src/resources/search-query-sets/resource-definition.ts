/**
 * Registers search-query-sets (list, CRUD, detail) with the Hermes dashboard resource registry.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  searchQuerySetsDashboardPage,
  searchQuerySetsHermesPathSegment,
} from "./dashboard-page";
import { searchQuerySetsRoutes } from "./routes";

/**
 * Hermes dashboard registration for versioned search query sets.
 */
export const searchQuerySetsHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "searchQuerySets",
    pathSegment: searchQuerySetsHermesPathSegment,
    order: 38,
    routes: searchQuerySetsRoutes,
    dashboardPage: searchQuerySetsDashboardPage,
  });
