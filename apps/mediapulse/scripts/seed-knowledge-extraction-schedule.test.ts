/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

import {
  AGENT_ID,
  AGENT_VERSION,
  ARTICLES_PER_RUN,
  CRON_EXPRESSION,
  EXTRACTION_MODEL,
  findMissingVariableKeys,
  knowledgeExtractionConfig,
  knowledgeExtractionInput,
  REQUIRED_VARIABLE_KEYS,
  seedKnowledgeExtractionSchedule,
  TICKER_EXPANSION,
} from "./seed-knowledge-extraction-schedule";

type Overrides = {
  registered?: { id: string } | null;
  variables?: { key: string }[];
  schedules?: {
    id: string;
    name: string;
    enabled: boolean;
    pipelineId: string;
  }[];
  pipeline?: { id: string; domainIntegrationId: string | null } | null;
  agentConfig?: { id: string } | null;
};

const buildDb = (overrides: Overrides = {}) => {
  const db = {
    agentRegistry: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          overrides.registered === undefined
            ? { id: "registry-1" }
            : overrides.registered,
        ),
    },
    variable: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          overrides.variables ?? REQUIRED_VARIABLE_KEYS.map((key) => ({ key })),
        ),
    },
    schedule: {
      findMany: vi.fn().mockResolvedValue(overrides.schedules ?? []),
      create: vi.fn().mockResolvedValue({ id: "schedule-new" }),
      update: vi.fn().mockResolvedValue({ id: "schedule-existing" }),
    },
    domainIntegration: {
      findFirst: vi.fn().mockResolvedValue({ id: "integration-1" }),
    },
    agentConfig: {
      findFirst: vi.fn().mockResolvedValue(overrides.agentConfig ?? null),
      create: vi.fn().mockResolvedValue({ id: "config-new" }),
      update: vi.fn().mockResolvedValue({ id: "config-existing" }),
    },
    pipeline: {
      findFirst: vi.fn().mockResolvedValue(overrides.pipeline ?? null),
      create: vi.fn().mockResolvedValue({ id: "pipeline-new" }),
      update: vi.fn().mockResolvedValue({ id: "pipeline-existing" }),
    },
    pipelineStep: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  return db as unknown as Pick<
    PrismaClientWithSchema,
    | "agentRegistry"
    | "agentConfig"
    | "variable"
    | "domainIntegration"
    | "pipeline"
    | "pipelineStep"
    | "schedule"
  > &
    typeof db;
};

const computeNextRunAtFn = () => new Date("2026-09-22T02:00:00.000Z");

describe("knowledgeExtractionInput", () => {
  it("fans one step into one invocation per subscribed issuer", () => {
    expect(knowledgeExtractionInput()).toStrictEqual({
      tickerId: TICKER_EXPANSION,
      limit: ARTICLES_PER_RUN,
    });
  });
});

describe("knowledgeExtractionConfig", () => {
  it("pins the benchmarked model and leaves the credentials as placeholders", () => {
    expect(knowledgeExtractionConfig()).toStrictEqual({
      model: EXTRACTION_MODEL,
      apiKey: "{{AI_API_KEY}}",
      baseUrl: "{{AI_BASE_URL}}",
    });
  });

  it("does not take its model from the shared AI_MODEL variable", () => {
    expect(JSON.stringify(knowledgeExtractionConfig())).not.toContain(
      "AI_MODEL",
    );
    expect(REQUIRED_VARIABLE_KEYS).not.toContain("AI_MODEL");
  });
});

describe("findMissingVariableKeys", () => {
  it("names the variables Hermes does not hold", async () => {
    const db = buildDb({ variables: [{ key: "AI_BASE_URL" }] });

    const missing = await findMissingVariableKeys(db);

    expect(missing).toStrictEqual(["AI_API_KEY"]);
  });

  it("reports nothing when every variable is present", async () => {
    const db = buildDb();

    expect(await findMissingVariableKeys(db)).toStrictEqual([]);
  });
});

describe("seedKnowledgeExtractionSchedule", () => {
  it("refuses to run when the agent version is not registered", async () => {
    const db = buildDb({ registered: null });

    await expect(
      seedKnowledgeExtractionSchedule({ apply: true, computeNextRunAtFn }, db),
    ).rejects.toThrow(new RegExp(`${AGENT_ID}@${AGENT_VERSION}`, "u"));
    expect(db.pipeline.create).not.toHaveBeenCalled();
  });

  it("refuses to run when an AI variable is missing, before writing anything", async () => {
    const db = buildDb({ variables: [] });

    await expect(
      seedKnowledgeExtractionSchedule({ apply: true, computeNextRunAtFn }, db),
    ).rejects.toThrow(/AI_API_KEY, AI_BASE_URL/u);
    expect(db.pipeline.create).not.toHaveBeenCalled();
    expect(db.schedule.create).not.toHaveBeenCalled();
  });

  it("writes nothing on a dry run", async () => {
    const db = buildDb();

    const result = await seedKnowledgeExtractionSchedule(
      { apply: false, computeNextRunAtFn },
      db,
    );

    expect(result.applied).toBe(false);
    expect(db.pipeline.create).not.toHaveBeenCalled();
    expect(db.agentConfig.create).not.toHaveBeenCalled();
    expect(db.schedule.create).not.toHaveBeenCalled();
  });

  it("creates the pipeline, config and a disabled schedule on a fresh Hermes", async () => {
    const db = buildDb();

    const result = await seedKnowledgeExtractionSchedule(
      { apply: true, computeNextRunAtFn },
      db,
    );

    expect(result.applied).toBe(true);
    expect(result.scheduleEnabled).toBe(false);
    expect(db.schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enabled: false,
          cronExpression: CRON_EXPRESSION,
          pipelineId: "pipeline-new",
        }),
      }),
    );
  });

  it("pins the step to this agent version and the config it just wrote", async () => {
    const db = buildDb();

    await seedKnowledgeExtractionSchedule(
      { apply: true, computeNextRunAtFn },
      db,
    );

    expect(db.pipelineStep.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          agentId: AGENT_ID,
          agentVersion: AGENT_VERSION,
          agentConfigId: "config-new",
          input: { tickerId: TICKER_EXPANSION, limit: ARTICLES_PER_RUN },
        }),
      }),
    );
  });

  it("rewrites the schedule already invoking this agent instead of adding a second", async () => {
    const db = buildDb({
      schedules: [
        {
          id: "schedule-existing",
          name: "Nightly Knowledge Ingestion",
          enabled: true,
          pipelineId: "pipeline-existing",
        },
      ],
      pipeline: {
        id: "pipeline-existing",
        domainIntegrationId: "integration-1",
      },
      agentConfig: { id: "config-existing" },
    });

    const result = await seedKnowledgeExtractionSchedule(
      { apply: true, computeNextRunAtFn },
      db,
    );

    expect(result.supersededScheduleNames).toStrictEqual([
      "Nightly Knowledge Ingestion",
    ]);
    expect(db.schedule.create).not.toHaveBeenCalled();
    expect(db.schedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "schedule-existing" } }),
    );
  });

  it("leaves an already-enabled schedule enabled", async () => {
    const db = buildDb({
      schedules: [
        {
          id: "schedule-existing",
          name: "Nightly Knowledge Ingestion",
          enabled: true,
          pipelineId: "pipeline-existing",
        },
      ],
    });

    const result = await seedKnowledgeExtractionSchedule(
      { apply: true, computeNextRunAtFn },
      db,
    );

    expect(result.scheduleEnabled).toBe(true);
  });

  it("drops steps a storyline-era pipeline left behind", async () => {
    const db = buildDb({
      pipeline: { id: "pipeline-existing", domainIntegrationId: null },
    });

    await seedKnowledgeExtractionSchedule(
      { apply: true, computeNextRunAtFn },
      db,
    );

    expect(db.pipelineStep.deleteMany).toHaveBeenCalledWith({
      where: { pipelineId: "pipeline-existing", order: { gte: 1 } },
    });
  });
});
