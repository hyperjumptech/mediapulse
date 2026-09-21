import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  knowledgeExtractionRunsDashboardPage,
  knowledgeExtractionRunsHermesPathSegment,
} from "./dashboard-page";
import { knowledgeExtractionRunsRoutes } from "./routes";

export const knowledgeExtractionRunsHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "knowledgeExtractionRuns",
    pathSegment: knowledgeExtractionRunsHermesPathSegment,
    order: 45,
    routes: knowledgeExtractionRunsRoutes,
    dashboardPage: knowledgeExtractionRunsDashboardPage,
  });
