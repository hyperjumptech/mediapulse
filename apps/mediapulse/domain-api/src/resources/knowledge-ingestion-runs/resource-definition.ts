import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  knowledgeIngestionRunsDashboardPage,
  knowledgeIngestionRunsHermesPathSegment,
} from "./dashboard-page";
import { knowledgeIngestionRunsRoutes } from "./routes";

export const knowledgeIngestionRunsHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "knowledgeIngestionRuns",
    pathSegment: knowledgeIngestionRunsHermesPathSegment,
    order: 46,
    routes: knowledgeIngestionRunsRoutes,
    dashboardPage: knowledgeIngestionRunsDashboardPage,
  });
