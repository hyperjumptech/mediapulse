/**
 * Registers newsletter feedback with the central Hermes dashboard resource registry.
 */

import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  feedbackDashboardPage,
  feedbackHermesPathSegment,
} from "./dashboard-page";
import { feedbackRoutes } from "./routes";

/** Hermes dashboard registration for the read-only newsletter feedback list. */
export const feedbackHermesDashboardResource = defineHermesDashboardResource({
  resourceKey: "feedback",
  pathSegment: feedbackHermesPathSegment,
  order: 65,
  routes: feedbackRoutes,
  dashboardPage: feedbackDashboardPage,
});
