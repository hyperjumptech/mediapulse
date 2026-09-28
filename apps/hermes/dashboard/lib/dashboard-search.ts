import type { Prisma, PrismaClient } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

import {
  DASHBOARD_SEARCH_MINIMUM_QUERY_LENGTH,
  type DashboardSearchResult,
} from "./dashboard-search-contract";

export type {
  DashboardSearchResult,
  DashboardSearchResultType,
} from "./dashboard-search-contract";

export const DASHBOARD_SEARCH_RESULTS_PER_TYPE = 5;

export type DashboardSearchDb = {
  pipeline: Pick<PrismaClient["pipeline"], "findMany">;
  schedule: Pick<PrismaClient["schedule"], "findMany">;
  httpTrigger: Pick<PrismaClient["httpTrigger"], "findMany">;
  agentRegistry: Pick<PrismaClient["agentRegistry"], "findMany">;
  agentConfig: Pick<PrismaClient["agentConfig"], "findMany">;
  variable: Pick<PrismaClient["variable"], "findMany">;
};

const searchPipelines = async (
  query: string,
  db: DashboardSearchDb,
): Promise<DashboardSearchResult[]> => {
  const findManyArgs = {
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
    take: DASHBOARD_SEARCH_RESULTS_PER_TYPE,
  } satisfies Prisma.PipelineFindManyArgs;
  const pipelines = await db.pipeline.findMany(findManyArgs);

  return pipelines.map(
    (pipeline): DashboardSearchResult => ({
      type: "pipeline",
      id: pipeline.id,
      label: pipeline.name,
      description: pipeline.description ?? undefined,
      href: `/dashboard/pipelines/${pipeline.id}`,
    }),
  );
};

const searchSchedules = async (
  query: string,
  db: DashboardSearchDb,
): Promise<DashboardSearchResult[]> => {
  const findManyArgs = {
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
    take: DASHBOARD_SEARCH_RESULTS_PER_TYPE,
  } satisfies Prisma.ScheduleFindManyArgs;
  const schedules = await db.schedule.findMany(findManyArgs);

  return schedules.map(
    (schedule): DashboardSearchResult => ({
      type: "schedule",
      id: schedule.id,
      label: schedule.name,
      description: schedule.description ?? undefined,
      href: `/dashboard/schedules/${schedule.id}`,
    }),
  );
};

const searchHttpTriggers = async (
  query: string,
  db: DashboardSearchDb,
): Promise<DashboardSearchResult[]> => {
  const findManyArgs = {
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
    take: DASHBOARD_SEARCH_RESULTS_PER_TYPE,
  } satisfies Prisma.HttpTriggerFindManyArgs;
  const httpTriggers = await db.httpTrigger.findMany(findManyArgs);

  return httpTriggers.map(
    (httpTrigger): DashboardSearchResult => ({
      type: "httpTrigger",
      id: httpTrigger.id,
      label: httpTrigger.name,
      description: httpTrigger.description ?? undefined,
      href: `/dashboard/http-triggers/${httpTrigger.id}`,
    }),
  );
};

const searchAgents = async (
  query: string,
  db: DashboardSearchDb,
): Promise<DashboardSearchResult[]> => {
  const findManyArgs = {
    where: {
      isActive: true,
      OR: [
        { agentId: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, agentId: true, agentVersion: true, description: true },
    orderBy: [{ agentId: "asc" }, { agentVersion: "desc" }],
    take: DASHBOARD_SEARCH_RESULTS_PER_TYPE,
  } satisfies Prisma.AgentRegistryFindManyArgs;
  const agents = await db.agentRegistry.findMany(findManyArgs);

  return agents.map(
    (agent): DashboardSearchResult => ({
      type: "agent",
      id: agent.id,
      label: `${agent.agentId}@${agent.agentVersion}`,
      description: agent.description ?? undefined,
      href: `/dashboard/agents/${agent.id}`,
    }),
  );
};

const searchAgentConfigs = async (
  query: string,
  db: DashboardSearchDb,
): Promise<DashboardSearchResult[]> => {
  const findManyArgs = {
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, agentId: true, agentVersion: true },
    orderBy: { name: "asc" },
    take: DASHBOARD_SEARCH_RESULTS_PER_TYPE,
  } satisfies Prisma.AgentConfigFindManyArgs;
  const agentConfigs = await db.agentConfig.findMany(findManyArgs);

  return agentConfigs.map(
    (agentConfig): DashboardSearchResult => ({
      type: "agentConfig",
      id: agentConfig.id,
      label: agentConfig.name,
      description: `${agentConfig.agentId}@${agentConfig.agentVersion}`,
      href: `/dashboard/agent-configs/${agentConfig.id}/edit`,
    }),
  );
};

const searchVariables = async (
  query: string,
  db: DashboardSearchDb,
): Promise<DashboardSearchResult[]> => {
  const findManyArgs = {
    where: { key: { contains: query, mode: "insensitive" } },
    select: { id: true, key: true, note: true },
    orderBy: { key: "asc" },
    take: DASHBOARD_SEARCH_RESULTS_PER_TYPE,
  } satisfies Prisma.VariableFindManyArgs;
  const variables = await db.variable.findMany(findManyArgs);

  return variables.map((variable): DashboardSearchResult => {
    const variableSearchParams = new URLSearchParams({ q: variable.key });

    return {
      type: "variable",
      id: variable.id,
      label: variable.key,
      description: variable.note ?? undefined,
      href: `/dashboard/variables?${variableSearchParams.toString()}`,
    };
  });
};

export const searchDashboardEntities = async (
  query: string,
  db: DashboardSearchDb = prisma,
): Promise<DashboardSearchResult[]> => {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < DASHBOARD_SEARCH_MINIMUM_QUERY_LENGTH) {
    return [];
  }

  const resultsByType = await Promise.all([
    searchPipelines(trimmedQuery, db),
    searchSchedules(trimmedQuery, db),
    searchHttpTriggers(trimmedQuery, db),
    searchAgents(trimmedQuery, db),
    searchAgentConfigs(trimmedQuery, db),
    searchVariables(trimmedQuery, db),
  ]);

  return resultsByType.flat();
};
