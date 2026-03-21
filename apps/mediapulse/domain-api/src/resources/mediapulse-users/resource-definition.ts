import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  mediapulseUsersDashboardPage,
  mediapulseUsersHermesPathSegment,
} from "./dashboard-page";
import { mediapulseUsersRoutes } from "./routes";

/**
 * Hermes dashboard registration for the Mediapulse users resource (routes + manifest page).
 */
export const mediapulseUsersHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "mediapulseUsers",
    pathSegment: mediapulseUsersHermesPathSegment,
    order: 15,
    routes: mediapulseUsersRoutes,
    dashboardPage: mediapulseUsersDashboardPage,
  });
