import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  publishersDashboardPage,
  publishersHermesPathSegment,
} from "./dashboard-page";
import { publishersRoutes } from "./routes";

export const publishersHermesDashboardResource = defineHermesDashboardResource({
  resourceKey: "publishers",
  pathSegment: publishersHermesPathSegment,
  order: 36,
  routes: publishersRoutes,
  dashboardPage: publishersDashboardPage,
});
