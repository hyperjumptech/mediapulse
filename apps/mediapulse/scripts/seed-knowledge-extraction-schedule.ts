/**
 * Configure the Hermes pipeline, agent config and schedule that run knowledge extraction.
 *
 * knowledge-ingestion 1.0.0 takes a required `tickerId` and reads its model credentials from config,
 * so a schedule written for 0.1.0 invokes it with an input it rejects. This rewrites that wiring:
 * one step per subscribed issuer through the `userTicker` expansion, with the three AI placeholders
 * Hermes substitutes at run time.
 *
 * Refuses to write when the registry has no active 1.0.0 entry, or when any AI variable is missing,
 * because both produce a schedule that fails on its first run instead of at setup.
 *
 * Dry run by default. Writes only with `--apply`, and leaves the schedule disabled so enabling it
 * stays a human decision.
 *
 * Run from the monorepo root:
 * `pnpm exec tsx apps/mediapulse/scripts/seed-knowledge-extraction-schedule.ts --apply`
 *
 * Against production, point it at that orchestration database:
 * `ORCHESTRATION_DATABASE_URL="postgresql://..." pnpm exec tsx apps/mediapulse/scripts/seed-knowledge-extraction-schedule.ts --apply`
 */

import { config } from "dotenv";
import fs from "fs";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";
import type { Prisma } from "@hermes/orchestration-database";
import path from "path";
import { fileURLToPath } from "url";

/** Fans one step into one invocation per subscribed issuer, as the other per-ticker agents do. */
export const TICKER_EXPANSION = "db:userTicker:tickerId?where.enabled=true";

export const AGENT_ID = "knowledge-ingestion";
export const AGENT_VERSION = "1.0.0";

export const PIPELINE_NAME = "Knowledge Extraction";
export const AGENT_CONFIG_NAME = "Knowledge Extraction";
export const SCHEDULE_NAME = "Nightly Knowledge Extraction";

/** Articles read per issuer per run. The server caps a request at 500. */
export const ARTICLES_PER_RUN = 100;

/**
 * Variables Hermes must hold for the config placeholders to resolve.
 *
 * The content-shaping agents already depend on these, so a production Hermes has them; a fresh
 * local one does not, and a run there would fail at its first model call.
 */
export const REQUIRED_VARIABLE_KEYS = [
  "AI_MODEL",
  "AI_API_KEY",
  "AI_BASE_URL",
] as const;

/** Runs after the newsletter, because the knowledge base is not an input to it (ADR 0013). */
export const CRON_EXPRESSION = "0 2 * * *";
export const TIMEZONE = "Asia/Jakarta";

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

/** Minimal Prisma delegate shape for {@link seedKnowledgeExtractionSchedule} (inject for tests). */
export type KnowledgeScheduleDb = Pick<
  PrismaClientWithSchema,
  | "agentRegistry"
  | "agentConfig"
  | "variable"
  | "domainIntegration"
  | "pipeline"
  | "pipelineStep"
  | "schedule"
>;

export type SeedKnowledgeExtractionScheduleResult = {
  applied: boolean;
  pipelineId: string | null;
  agentConfigId: string | null;
  scheduleId: string | null;
  scheduleEnabled: boolean;
  /** Schedules already pointing at this agent, which this script rewrites rather than duplicates. */
  supersededScheduleNames: string[];
  missingVariableKeys: string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads Hermes script environment variables from the app-local .env file.
 *
 * - Important: dotenv never overwrites a variable the shell already set, so exporting
 *   `ORCHESTRATION_DATABASE_URL` is what points this script at a database other than the local one,
 *   and the local file is only a fallback.
 */
const loadHermesScriptEnv = (): void => {
  const envPath = path.resolve(__dirname, "../../hermes/dashboard/.env.local");
  if (!fs.existsSync(envPath)) {
    console.log(
      `No ${envPath}; relying on the environment for ORCHESTRATION_DATABASE_URL.`,
    );

    return;
  }

  config({ path: envPath });
  console.log(
    `Loaded ${envPath}. A variable already set in the environment keeps its value.`,
  );
};

/**
 * The config Hermes stores for this agent.
 *
 * The placeholders are substituted per run from the Variable table. They live here rather than in
 * the agent's own schema defaults because substitution reads the stored config, so an agent invoked
 * with no config row would receive the placeholder strings verbatim.
 */
export const knowledgeExtractionConfig = (): Prisma.InputJsonValue => ({
  model: "{{AI_MODEL}}",
  apiKey: "{{AI_API_KEY}}",
  baseUrl: "{{AI_BASE_URL}}",
});

/** The input one step carries: one invocation per subscribed issuer. */
export const knowledgeExtractionInput = (): Prisma.InputJsonValue => ({
  tickerId: TICKER_EXPANSION,
  limit: ARTICLES_PER_RUN,
});

/**
 * Lists the required variable keys the target Hermes does not hold.
 *
 * @param db - Orchestration delegates.
 */
export const findMissingVariableKeys = async (
  db: KnowledgeScheduleDb,
): Promise<string[]> => {
  const present = await db.variable.findMany({
    where: { key: { in: [...REQUIRED_VARIABLE_KEYS] } },
    select: { key: true },
  });
  const presentKeys = new Set(present.map((variable) => variable.key));

  return REQUIRED_VARIABLE_KEYS.filter((key) => !presentKeys.has(key));
};

/**
 * Configures the pipeline, agent config and schedule for knowledge extraction.
 *
 * @param options - Whether to write, and an injected next-run calculator.
 * @param db - Optional orchestration client (defaults to the client from the database package).
 * @returns What was found and what was written.
 * @throws When the agent registry holds no active entry for this agent version.
 */
export const seedKnowledgeExtractionSchedule = async (
  options: { apply: boolean; computeNextRunAtFn?: ComputeNextRunAtFn },
  db?: KnowledgeScheduleDb,
): Promise<SeedKnowledgeExtractionScheduleResult> => {
  const targetDb =
    db ?? (await import("@hermes/orchestration-database")).prisma;

  const registered = await targetDb.agentRegistry.findFirst({
    where: { agentId: AGENT_ID, agentVersion: AGENT_VERSION, isActive: true },
    select: { id: true },
  });
  if (registered === null) {
    throw new Error(
      `No active registry entry for ${AGENT_ID}@${AGENT_VERSION}. Deploy the agent and let it register before configuring its schedule.`,
    );
  }

  const missingVariableKeys = await findMissingVariableKeys(targetDb);

  // Schedules already invoking this agent, whatever they are called. Reported so an operator can
  // see that this rewrites the existing wiring instead of leaving a second schedule behind.
  const existingSchedules = await targetDb.schedule.findMany({
    where: { pipeline: { steps: { some: { agentId: AGENT_ID } } } },
    select: { id: true, name: true, enabled: true, pipelineId: true },
  });

  const result: SeedKnowledgeExtractionScheduleResult = {
    applied: false,
    pipelineId: null,
    agentConfigId: null,
    scheduleId: null,
    scheduleEnabled: false,
    supersededScheduleNames: existingSchedules.map((schedule) => schedule.name),
    missingVariableKeys,
  };

  if (missingVariableKeys.length > 0) {
    throw new Error(
      `Hermes is missing ${missingVariableKeys.join(", ")}. Add them as variables (AI_API_KEY as a secret) before configuring this schedule, or its first run fails at the model call.`,
    );
  }

  if (!options.apply) {
    return result;
  }

  const integration = await targetDb.domainIntegration.findFirst({
    orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
    select: { id: true },
  });
  if (integration === null) {
    throw new Error(
      "No domain integration row in the orchestration database; register one before configuring pipelines.",
    );
  }

  const existingConfig = await targetDb.agentConfig.findFirst({
    where: { name: AGENT_CONFIG_NAME, agentId: AGENT_ID },
    select: { id: true },
  });
  const agentConfig =
    existingConfig === null
      ? await targetDb.agentConfig.create({
          data: {
            name: AGENT_CONFIG_NAME,
            description:
              "Model credentials for knowledge extraction, substituted from Hermes variables.",
            agentId: AGENT_ID,
            agentVersion: AGENT_VERSION,
            config: knowledgeExtractionConfig(),
          },
          select: { id: true },
        })
      : await targetDb.agentConfig.update({
          where: { id: existingConfig.id },
          data: {
            agentVersion: AGENT_VERSION,
            config: knowledgeExtractionConfig(),
          },
          select: { id: true },
        });

  const existingPipeline = await targetDb.pipeline.findFirst({
    where: {
      OR: [{ name: PIPELINE_NAME }, { steps: { some: { agentId: AGENT_ID } } }],
    },
    select: { id: true, domainIntegrationId: true },
  });
  const pipeline =
    existingPipeline === null
      ? await targetDb.pipeline.create({
          data: {
            name: PIPELINE_NAME,
            description:
              "Reads each subscribed issuer's articles for the entities they name and the relations they state.",
            isActive: true,
            domainIntegrationId: integration.id,
          },
          select: { id: true },
        })
      : await targetDb.pipeline.update({
          where: { id: existingPipeline.id },
          data: {
            name: PIPELINE_NAME,
            description:
              "Reads each subscribed issuer's articles for the entities they name and the relations they state.",
            isActive: true,
            domainIntegrationId:
              existingPipeline.domainIntegrationId ?? integration.id,
          },
          select: { id: true },
        });

  await targetDb.pipelineStep.upsert({
    where: { pipelineId_order: { pipelineId: pipeline.id, order: 0 } },
    create: {
      order: 0,
      pipelineId: pipeline.id,
      agentId: AGENT_ID,
      agentVersion: AGENT_VERSION,
      agentConfigId: agentConfig.id,
      input: knowledgeExtractionInput(),
    },
    update: {
      agentId: AGENT_ID,
      agentVersion: AGENT_VERSION,
      agentConfigId: agentConfig.id,
      input: knowledgeExtractionInput(),
    },
  });

  // A storyline-era pipeline may have carried several steps. Anything past the first is not part of
  // extraction and would invoke an agent this pipeline no longer describes.
  await targetDb.pipelineStep.deleteMany({
    where: { pipelineId: pipeline.id, order: { gte: 1 } },
  });

  const computeNextRunAt =
    options.computeNextRunAtFn ??
    (await import("@hermes/scheduler")).computeNextRunAt;
  const nextRunAt = computeNextRunAt(
    {
      repeat: "repeating",
      cronExpression: CRON_EXPRESSION,
      interval: null,
      timezone: TIMEZONE,
      nextRunAt: null,
    },
    new Date(),
  );
  if (nextRunAt === null) {
    throw new Error(
      `Could not compute the next run time for "${CRON_EXPRESSION}" in ${TIMEZONE}.`,
    );
  }

  const existingSchedule = existingSchedules[0] ?? null;
  // An already-enabled schedule stays enabled: this rewrites how it runs, and switching a running
  // schedule off is a separate decision from fixing its wiring.
  const enabled = existingSchedule?.enabled ?? false;
  const scheduleData = {
    name: SCHEDULE_NAME,
    description:
      "Reads each subscribed issuer's unread articles nightly, after the newsletter has shipped.",
    repeat: "repeating" as const,
    cronExpression: CRON_EXPRESSION,
    timezone: TIMEZONE,
    nextRunAt,
    priority: 0,
    enabled,
  };

  const schedule =
    existingSchedule === null
      ? await targetDb.schedule.create({
          data: { ...scheduleData, pipelineId: pipeline.id },
          select: { id: true },
        })
      : await targetDb.schedule.update({
          where: { id: existingSchedule.id },
          data: { ...scheduleData, pipelineId: pipeline.id },
          select: { id: true },
        });

  return {
    ...result,
    applied: true,
    pipelineId: pipeline.id,
    agentConfigId: agentConfig.id,
    scheduleId: schedule.id,
    scheduleEnabled: enabled,
  };
};

const main = async (): Promise<void> => {
  loadHermesScriptEnv();
  const apply = process.argv.includes("--apply");

  const result = await seedKnowledgeExtractionSchedule({ apply });

  if (result.supersededScheduleNames.length > 0) {
    console.log(
      `Rewriting the existing schedule(s) for ${AGENT_ID}: ${result.supersededScheduleNames.join(", ")}`,
    );
  }

  if (!result.applied) {
    console.log(
      `Dry run: ${AGENT_ID}@${AGENT_VERSION} is registered and every AI variable is present. Pass --apply to write.`,
    );

    return;
  }

  console.log(
    `Configured pipeline ${result.pipelineId ?? "-"}, agent config ${result.agentConfigId ?? "-"}, schedule ${result.scheduleId ?? "-"} (${CRON_EXPRESSION} ${TIMEZONE}).`,
  );
  console.log(
    result.scheduleEnabled
      ? "The schedule is enabled, as it already was."
      : "The schedule is disabled. Enable it in Hermes when you want it to run.",
  );
};

const isCliEntry = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isCliEntry) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Failed to configure knowledge extraction", error);
      process.exit(1);
    });
}
