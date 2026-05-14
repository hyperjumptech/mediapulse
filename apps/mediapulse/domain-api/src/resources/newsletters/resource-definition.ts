import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  newslettersDashboardPage,
  newslettersHermesPathSegment,
} from "./dashboard-page";
import { newslettersRoutes } from "./routes";

/** Hermes dashboard registration for the read-only newsletters list. */
export const newslettersHermesDashboardResource = defineHermesDashboardResource(
  {
    resourceKey: "newsletters",
    pathSegment: newslettersHermesPathSegment,
    order: 60,
    routes: newslettersRoutes,
    dashboardPage: newslettersDashboardPage,
  },
);
