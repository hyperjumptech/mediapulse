import { defineHermesDashboardResource } from "../../hermes-dashboard/hermes-dashboard-resource-types";
import {
  knowledgeBaseDashboardPage,
  knowledgeBaseHermesPathSegment,
} from "./dashboard-page";
import { knowledgeBaseRoutes } from "./routes";

export const knowledgeBaseHermesDashboardResource =
  defineHermesDashboardResource({
    resourceKey: "knowledgeBase",
    pathSegment: knowledgeBaseHermesPathSegment,
    order: 44,
    routes: knowledgeBaseRoutes,
    dashboardPage: knowledgeBaseDashboardPage,
  });
