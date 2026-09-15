import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  storylinesDashboardPage,
  storylinesHermesPathSegment,
} from "./dashboard-page";
import { storylinesRoutes } from "./routes";

export const storylinesHermesDashboardResource = defineHermesDashboardResource({
  resourceKey: "storylines",
  pathSegment: storylinesHermesPathSegment,
  order: 45,
  routes: storylinesRoutes,
  dashboardPage: storylinesDashboardPage,
});
