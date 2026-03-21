import { config } from "dotenv";
import fs from "fs";
import type { PrismaClientWithSchema } from "@workspace/orchestration-database/client";
import type { Prisma } from "@workspace/orchestration-database";
import path from "path";
import { fileURLToPath } from "url";

const TICKER_EXPANSION = "db:userTicker:tickerId?where.enabled=true";

type PipelineStepDefinition = {
  agentId: string;
  agentVersion: string;
  input: Prisma.InputJsonValue;
};

type PipelineScheduleDefinition = {
  name: string;
  description: string;
  cronExpression: string;
  timezone: string;
};

type PipelineDefinition = {
  name: string;
  description: string;
  steps: PipelineStepDefinition[];
  schedule: PipelineScheduleDefinition;
};

type SeedKgPipelinesResult = {
  pipelinesSeeded: number;
  stepsSeeded: number;
  schedulesSeeded: number;
};

type ComputeNextRunAtInput = {
  repeat: "repeating";
  cronExpression: string;
  interval: null;
  timezone: string;
  nextRunAt: null;
};

type ComputeNextRunAtFn = (
  schedule: ComputeNextRunAtInput,
  now: Date,
) => Date | null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads Hermes script environment variables from the app-local .env file.
 */
const loadHermesScriptEnv = (): void => {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error("The .env.local file does not exist in the app root.");
    process.exit(1);
  }

  config({ path: envPath });
  console.log(`Loading environment variables from ${envPath}`);
};

const KG_PIPELINE_DEFINITIONS: PipelineDefinition[] = [
  {
    name: "Query Analysis",
    description:
      "Generate search queries for each subscribed ticker using KG context",
    steps: [
      {
        agentId: "query-analysis",
        agentVersion: "1.0.0",
        input: { tickerId: TICKER_EXPANSION },
      },
    ],
    schedule: {
      name: "Daily Query Analysis",
      description:
        "Runs query-analysis daily for each subscribed ticker via userTicker expansion.",
      cronExpression: "0 5 * * *",
      timezone: "Asia/Jakarta",
    },
  },
  {
    name: "Data Collection",
    description: "Crawl and collect news articles for each subscribed ticker",
    steps: [
      {
        agentId: "data-collection",
        agentVersion: "1.0.0",
        input: { tickerId: TICKER_EXPANSION },
      },
    ],
    schedule: {
      name: "4x Daily Data Collection",
      description:
        "Runs data-collection at 06:00, 10:00, 14:00, and 18:00 WIB for each subscribed ticker.",
      cronExpression: "0 6,10,14,18 * * *",
      timezone: "Asia/Jakarta",
    },
  },
  {
    name: "Analysis & Newsletter",
    description:
      "Analyze collected articles, score relevance, generate newsletter, and deliver",
    steps: [
      {
        agentId: "analysis",
        agentVersion: "1.0.0",
        input: { tickerId: TICKER_EXPANSION },
      },
      {
        agentId: "content-generation",
        agentVersion: "1.0.0",
        input: { tickerId: TICKER_EXPANSION },
      },
      {
        agentId: "delivery",
        agentVersion: "1.0.0",
        input: { tickerId: TICKER_EXPANSION },
      },
    ],
    schedule: {
      name: "Daily Newsletter",
      description:
        "Runs analysis, content-generation, and delivery daily for each subscribed ticker.",
      cronExpression: "0 20 * * *",
      timezone: "Asia/Jakarta",
    },
  },
];

/**
 * Ensures every pipeline step references an active agent in the registry.
 *
 * @param db - Database client used to read agent registry entries.
 * @param definitions - Pipeline definitions to validate.
 */
const assertAgentsRegistered = async (
  db: PrismaClientWithSchema,
  definitions: PipelineDefinition[],
): Promise<void> => {
  for (const definition of definitions) {
    for (const step of definition.steps) {
      const agent = await db.agentRegistry.findFirst({
        where: {
          agentId: step.agentId,
          agentVersion: step.agentVersion,
          isActive: true,
        },
      });

      if (!agent) {
        throw new Error(
          `Missing active agent registry entry for ${step.agentId}@${step.agentVersion}`,
        );
      }
    }
  }
};

/**
 * Creates or updates a pipeline and its ordered step list.
 *
 * @param db - Database client used for pipeline writes.
 * @param definition - Target pipeline definition.
 * @returns Persisted pipeline id and number of steps written.
 */
const upsertPipelineWithSteps = async (
  db: PrismaClientWithSchema,
  definition: PipelineDefinition,
): Promise<{ pipelineId: string; stepsSeeded: number }> => {
  const existingPipeline = await db.pipeline.findFirst({
    where: { name: definition.name },
  });

  const pipeline = existingPipeline
    ? await db.pipeline.update({
        where: { id: existingPipeline.id },
        data: {
          name: definition.name,
          description: definition.description,
          isActive: true,
        },
      })
    : await db.pipeline.create({
        data: {
          name: definition.name,
          description: definition.description,
          isActive: true,
        },
      });

  for (const [index, step] of definition.steps.entries()) {
    await db.pipelineStep.upsert({
      where: {
        pipelineId_order: {
          pipelineId: pipeline.id,
          order: index,
        },
      },
      create: {
        pipelineId: pipeline.id,
        order: index,
        agentId: step.agentId,
        agentVersion: step.agentVersion,
        input: step.input,
        config: {},
      },
      update: {
        agentId: step.agentId,
        agentVersion: step.agentVersion,
        input: step.input,
        config: {},
      },
    });
  }

  await db.pipelineStep.deleteMany({
    where: {
      pipelineId: pipeline.id,
      order: {
        gte: definition.steps.length,
      },
    },
  });

  return {
    pipelineId: pipeline.id,
    stepsSeeded: definition.steps.length,
  };
};

/**
 * Creates or updates a disabled repeating schedule for a pipeline.
 *
 * @param db - Database client used for schedule writes.
 * @param pipelineId - Pipeline id the schedule should run.
 * @param schedule - Schedule definition.
 */
const upsertSchedule = async (
  db: PrismaClientWithSchema,
  pipelineId: string,
  schedule: PipelineScheduleDefinition,
  computeNextRunAtFn: ComputeNextRunAtFn,
): Promise<void> => {
  const nextRunAt = computeNextRunAtFn(
    {
      repeat: "repeating",
      cronExpression: schedule.cronExpression,
      interval: null,
      timezone: schedule.timezone,
      nextRunAt: null,
    },
    new Date(),
  );

  if (!nextRunAt) {
    throw new Error(
      `Failed to compute next run time for schedule "${schedule.name}"`,
    );
  }

  const existingSchedule = await db.schedule.findFirst({
    where: {
      name: schedule.name,
      pipelineId,
    },
  });

  if (existingSchedule) {
    await db.schedule.update({
      where: { id: existingSchedule.id },
      data: {
        name: schedule.name,
        description: schedule.description,
        repeat: "repeating",
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        nextRunAt,
        priority: 0,
        enabled: false,
      },
    });
    return;
  }

  await db.schedule.create({
    data: {
      name: schedule.name,
      description: schedule.description,
      repeat: "repeating",
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      nextRunAt,
      pipelineId,
      priority: 0,
      enabled: false,
    },
  });
};

/**
 * Seeds the three KG pipelines and their schedules.
 * The operation is idempotent and safe to re-run.
 *
 * @param db - Optional injected database client for tests.
 * @returns Counts of seeded pipelines, steps, and schedules.
 */
export const seedKgPipelines = async (
  db?: PrismaClientWithSchema,
  computeNextRunAtFn?: ComputeNextRunAtFn,
): Promise<SeedKgPipelinesResult> => {
  const targetDb =
    db ?? (await import("@workspace/orchestration-database")).prisma;
  const resolvedComputeNextRunAt =
    computeNextRunAtFn ??
    (await import("@workspace/hermes-scheduler")).computeNextRunAt;

  await assertAgentsRegistered(targetDb, KG_PIPELINE_DEFINITIONS);

  let stepsSeeded = 0;
  for (const definition of KG_PIPELINE_DEFINITIONS) {
    const { pipelineId, stepsSeeded: writtenStepCount } =
      await upsertPipelineWithSteps(targetDb, definition);
    await upsertSchedule(
      targetDb,
      pipelineId,
      definition.schedule,
      resolvedComputeNextRunAt,
    );
    stepsSeeded += writtenStepCount;
  }

  return {
    pipelinesSeeded: KG_PIPELINE_DEFINITIONS.length,
    stepsSeeded,
    schedulesSeeded: KG_PIPELINE_DEFINITIONS.length,
  };
};

/**
 * Runs the KG pipeline seed as a CLI script.
 */
const main = async (): Promise<void> => {
  loadHermesScriptEnv();
  const result = await seedKgPipelines();
  console.log(
    `Seeded ${result.pipelinesSeeded} pipelines, ${result.stepsSeeded} steps, and ${result.schedulesSeeded} schedules.`,
  );
};

const isCliEntry = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isCliEntry) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Failed to seed KG pipelines", error);
      process.exit(1);
    });
}
