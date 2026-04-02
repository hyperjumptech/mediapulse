import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  deliveryRunsDashboardPage,
  deliveryRunsHermesPathSegment,
} from "./dashboard-page";
import { deliveryRunsRoutes } from "./routes";

/** Hermes dashboard registration for delivery run diagnostics. */
export const deliveryRunsHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "deliveryRuns",
    pathSegment: deliveryRunsHermesPathSegment,
    order: 55,
    routes: deliveryRunsRoutes,
    dashboardPage: deliveryRunsDashboardPage,
  });
