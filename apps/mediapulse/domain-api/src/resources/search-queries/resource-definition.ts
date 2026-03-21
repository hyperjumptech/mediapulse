/**
 * Registers search-queries (list + delete) with the Hermes dashboard resource registry.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  searchQueriesDashboardPage,
  searchQueriesHermesPathSegment,
} from "./dashboard-page";
import { searchQueriesRoutes } from "./routes";

/**
 * Hermes dashboard registration for the search queries resource (routes + manifest page).
 */
export const searchQueriesHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "searchQueries",
    pathSegment: searchQueriesHermesPathSegment,
    order: 40,
    routes: searchQueriesRoutes,
    dashboardPage: searchQueriesDashboardPage,
  });
