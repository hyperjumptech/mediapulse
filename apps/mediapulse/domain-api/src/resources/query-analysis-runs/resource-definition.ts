import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  queryAnalysisRunsDashboardPage,
  queryAnalysisRunsHermesPathSegment,
} from "./dashboard-page";
import { queryAnalysisRunsRoutes } from "./routes";

/** Hermes dashboard registration for the query-analysis run chronicle. */
export const queryAnalysisRunsHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "queryAnalysisRuns",
    pathSegment: queryAnalysisRunsHermesPathSegment,
    order: 56,
    routes: queryAnalysisRunsRoutes,
    dashboardPage: queryAnalysisRunsDashboardPage,
  });
