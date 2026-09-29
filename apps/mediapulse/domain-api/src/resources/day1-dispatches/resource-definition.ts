import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  DAY1_DISPATCHES_ORDER,
  day1DispatchesDashboardPage,
  day1DispatchesHermesPathSegment,
} from "./dashboard-page";
import { day1DispatchesRoutes } from "./routes";

export const day1DispatchesHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "day1Dispatches",
    pathSegment: day1DispatchesHermesPathSegment,
    order: DAY1_DISPATCHES_ORDER,
    routes: day1DispatchesRoutes,
    dashboardPage: day1DispatchesDashboardPage,
  });
