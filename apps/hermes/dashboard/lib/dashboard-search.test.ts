/** @vitest-environment node */
import type {
  AgentConfig,
  AgentRegistry,
  HttpTrigger,
  Pipeline,
  Schedule,
  Variable,
} from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DASHBOARD_SEARCH_RESULTS_PER_TYPE,
  searchDashboardEntities,
  type DashboardSearchDb,
} from "./dashboard-search";

type PipelineRow = Pick<Pipeline, "id" | "name" | "description">;
type ScheduleRow = Pick<Schedule, "id" | "name" | "description">;
type HttpTriggerRow = Pick<HttpTrigger, "id" | "name" | "description">;
type AgentRow = Pick<
  AgentRegistry,
  "id" | "agentId" | "agentVersion" | "description"
>;
type AgentConfigRow = Pick<
  AgentConfig,
  "id" | "name" | "agentId" | "agentVersion"
>;
type VariableRow = Pick<Variable, "id" | "key" | "note">;

type SearchRows = {
  pipelines?: PipelineRow[];
  schedules?: ScheduleRow[];
  httpTriggers?: HttpTriggerRow[];
  agents?: AgentRow[];
  agentConfigs?: AgentConfigRow[];
  variables?: VariableRow[];
};

const createDb = (rows: SearchRows = {}) => ({
  pipeline: {
    findMany: vi.fn().mockResolvedValue(rows.pipelines ?? []),
  },
  schedule: {
    findMany: vi.fn().mockResolvedValue(rows.schedules ?? []),
  },
  httpTrigger: {
    findMany: vi.fn().mockResolvedValue(rows.httpTriggers ?? []),
  },
  agentRegistry: {
    findMany: vi.fn().mockResolvedValue(rows.agents ?? []),
  },
  agentConfig: {
    findMany: vi.fn().mockResolvedValue(rows.agentConfigs ?? []),
  },
  variable: {
    findMany: vi.fn().mockResolvedValue(rows.variables ?? []),
  },
});

const asSearchDb = (db: ReturnType<typeof createDb>): DashboardSearchDb =>
  db as unknown as DashboardSearchDb;

const insensitiveContains = (query: string) => ({
  contains: query,
  mode: "insensitive",
});

describe("searchDashboardEntities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["", " ", "a", "  a  "])(
    "returns no results without querying for the short query %j",
    async (query) => {
      // Setup
      const db = createDb();

      // Act
      const results = await searchDashboardEntities(query, asSearchDb(db));

      // Assert
      expect(results).toEqual([]);
      expect(db.pipeline.findMany).not.toHaveBeenCalled();
      expect(db.schedule.findMany).not.toHaveBeenCalled();
      expect(db.httpTrigger.findMany).not.toHaveBeenCalled();
      expect(db.agentRegistry.findMany).not.toHaveBeenCalled();
      expect(db.agentConfig.findMany).not.toHaveBeenCalled();
      expect(db.variable.findMany).not.toHaveBeenCalled();
    },
  );

  it("queries every model once with the trimmed query, narrow selects, and a per-type limit", async () => {
    // Setup
    const db = createDb();

    // Act
    await searchDashboardEntities("  Daily  ", asSearchDb(db));

    // Assert
    expect(DASHBOARD_SEARCH_RESULTS_PER_TYPE).toBe(5);
    expect(db.pipeline.findMany).toHaveBeenCalledTimes(1);
    expect(db.pipeline.findMany).toHaveBeenCalledWith({
      where: { name: insensitiveContains("Daily") },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
      take: 5,
    });
    expect(db.schedule.findMany).toHaveBeenCalledTimes(1);
    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: { name: insensitiveContains("Daily") },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
      take: 5,
    });
    expect(db.httpTrigger.findMany).toHaveBeenCalledTimes(1);
    expect(db.httpTrigger.findMany).toHaveBeenCalledWith({
      where: { name: insensitiveContains("Daily") },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
      take: 5,
    });
    expect(db.agentRegistry.findMany).toHaveBeenCalledTimes(1);
    expect(db.agentRegistry.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [
          { agentId: insensitiveContains("Daily") },
          { description: insensitiveContains("Daily") },
        ],
      },
      select: {
        id: true,
        agentId: true,
        agentVersion: true,
        description: true,
      },
      orderBy: [{ agentId: "asc" }, { agentVersion: "desc" }],
      take: 5,
    });
    expect(db.agentConfig.findMany).toHaveBeenCalledTimes(1);
    expect(db.agentConfig.findMany).toHaveBeenCalledWith({
      where: { name: insensitiveContains("Daily") },
      select: { id: true, name: true, agentId: true, agentVersion: true },
      orderBy: { name: "asc" },
      take: 5,
    });
    expect(db.variable.findMany).toHaveBeenCalledTimes(1);
    expect(db.variable.findMany).toHaveBeenCalledWith({
      where: { key: insensitiveContains("Daily") },
      select: { id: true, key: true, note: true },
      orderBy: { key: "asc" },
      take: 5,
    });
  });

  it("starts every model query before any of them resolves", async () => {
    // Setup
    const db = createDb();
    let resolvePipelines: (rows: PipelineRow[]) => void = () => undefined;
    const pendingPipelines = new Promise<PipelineRow[]>((resolve) => {
      resolvePipelines = resolve;
    });
    db.pipeline.findMany.mockReturnValue(pendingPipelines);

    // Act
    const searchPromise = searchDashboardEntities("digest", asSearchDb(db));

    // Assert
    expect(db.schedule.findMany).toHaveBeenCalledTimes(1);
    expect(db.httpTrigger.findMany).toHaveBeenCalledTimes(1);
    expect(db.agentRegistry.findMany).toHaveBeenCalledTimes(1);
    expect(db.agentConfig.findMany).toHaveBeenCalledTimes(1);
    expect(db.variable.findMany).toHaveBeenCalledTimes(1);

    resolvePipelines([]);

    await expect(searchPromise).resolves.toEqual([]);
  });

  it("maps every model to a result with its label, description, and detail href in type order", async () => {
    // Setup
    const db = createDb({
      pipelines: [
        { id: "pipeline-1", name: "Daily digest", description: "Runs daily" },
      ],
      schedules: [{ id: "schedule-1", name: "Daily 6am", description: null }],
      httpTriggers: [
        { id: "trigger-1", name: "Daily webhook", description: "Inbound" },
      ],
      agents: [
        {
          id: "agent-row-1",
          agentId: "daily-summarizer",
          agentVersion: "1.2.0",
          description: "Summarizes daily items",
        },
      ],
      agentConfigs: [
        {
          id: "config-1",
          name: "Daily config",
          agentId: "daily-summarizer",
          agentVersion: "1.2.0",
        },
      ],
      variables: [
        { id: "variable-1", key: "DAILY_LIMIT&SIZE", note: "Max items" },
      ],
    });

    // Act
    const results = await searchDashboardEntities("daily", asSearchDb(db));

    // Assert
    expect(results).toEqual([
      {
        type: "pipeline",
        id: "pipeline-1",
        label: "Daily digest",
        description: "Runs daily",
        href: "/dashboard/pipelines/pipeline-1",
      },
      {
        type: "schedule",
        id: "schedule-1",
        label: "Daily 6am",
        href: "/dashboard/schedules/schedule-1",
      },
      {
        type: "httpTrigger",
        id: "trigger-1",
        label: "Daily webhook",
        description: "Inbound",
        href: "/dashboard/http-triggers/trigger-1",
      },
      {
        type: "agent",
        id: "agent-row-1",
        label: "daily-summarizer@1.2.0",
        description: "Summarizes daily items",
        href: "/dashboard/agents/agent-row-1",
      },
      {
        type: "agentConfig",
        id: "config-1",
        label: "Daily config",
        description: "daily-summarizer@1.2.0",
        href: "/dashboard/agent-configs/config-1/edit",
      },
      {
        type: "variable",
        id: "variable-1",
        label: "DAILY_LIMIT&SIZE",
        description: "Max items",
        href: "/dashboard/variables?q=DAILY_LIMIT%26SIZE",
      },
    ]);
  });

  it("leaves the description undefined when agents and variables have none", async () => {
    // Setup
    const db = createDb({
      agents: [
        {
          id: "agent-row-2",
          agentId: "ticker-echo",
          agentVersion: "0.1.0",
          description: null,
        },
      ],
      variables: [{ id: "variable-2", key: "ECHO_MODE", note: null }],
    });

    // Act
    const results = await searchDashboardEntities("echo", asSearchDb(db));

    // Assert
    expect(results.map((result) => result.description)).toEqual([
      undefined,
      undefined,
    ]);
  });
});
