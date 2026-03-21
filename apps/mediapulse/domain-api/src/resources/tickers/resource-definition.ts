/**
 * Registers the tickers resource (routes + manifest) in `hermesDashboardResources`.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  tickersDashboardPage,
  tickersHermesPathSegment,
} from "./dashboard-page";
import { tickersRoutes } from "./routes";

/**
 * Hermes dashboard registration for the tickers resource (routes + manifest page).
 */
export const tickersHermesDashboardResource = defineHermesDashboardResource({
  resourceKey: "tickers",
  pathSegment: tickersHermesPathSegment,
  order: 10,
  routes: tickersRoutes,
  dashboardPage: tickersDashboardPage,
});
