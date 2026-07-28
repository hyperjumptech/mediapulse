import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  tickerProfilesDashboardPage,
  tickerProfilesHermesPathSegment,
} from "./dashboard-page";
import { tickerProfilesRoutes } from "./routes";

export const tickerProfilesHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "tickerProfiles",
    pathSegment: tickerProfilesHermesPathSegment,
    order: 11,
    routes: tickerProfilesRoutes,
    dashboardPage: tickerProfilesDashboardPage,
  });
