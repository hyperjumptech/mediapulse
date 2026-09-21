/**
 * Run knowledge extraction for one issuer, once, through Hermes.
 *
 * Useful before enabling the nightly schedule across every issuer: one run shows what the model
 * makes of a real corpus, and what it gets refused for, at the cost of one issuer's articles.
 *
 * The run goes through Hermes rather than invoking the agent directly, because the model credentials
 * live in an encrypted variable that only Hermes can resolve.
 *
 * - Important: this never touches the nightly pipeline, step or schedule. It creates a throwaway
 *   pipeline and schedule, waits for the worker to fire them, and removes both in a `finally`. The
 *   alternative, pointing the real step at one ticker and putting it back afterwards, leaves the
 *   nightly run pinned to a single issuer if anything fails in between.
 *
 * Dry run by default. Writes only with `--apply`.
 *
 * Run from the monorepo root:
 * `pnpm --filter @mediapulse/scripts run extraction-once -- --symbol FORE --limit 30 --apply`
 *
 * Against production, point it at that orchestration database:
 * `ORCHESTRATION_DATABASE_URL="postgresql://..." pnpm --filter @mediapulse/scripts run extraction-once -- --symbol FORE --limit 30 --apply`
 */

import { config } from "dotenv";
import fs from "fs";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";
import path from "path";
import { fileURLToPath } from "url";

import {
  AGENT_ID,
  AGENT_VERSION,
  findMissingVariableKeys,
  knowledgeExtractionConfig,
} from "./seed-knowledge-extraction-schedule.js";

/** Names the throwaway rows so an interrupted run leaves something obviously disposable behind. */
export const ONE_SHOT_NAME_PREFIX = "One-shot Knowledge Extraction";

/**
 * How long to wait for the worker to pick the schedule up and the run to finish.
 *
 * The agent reads articles one at a time, and a production article takes appreciably longer than a
 * local one: 30 of FORE's took over ten minutes. This is sized for 100, the nightly cap.
 */
export const DEFAULT_WAIT_SECONDS = 3_600;

/** How often to look for the run row while waiting. */
export const POLL_INTERVAL_MS = 5_000;

/** Minimal Prisma delegate shape for {@link runExtractionOnce} (inject for tests). */
export type OneShotDb = Pick<
  PrismaClientWithSchema,
  | "agentRegistry"
  | "agentConfig"
  | "variable"
  | "domainIntegration"
  | "pipeline"
  | "pipelineStep"
  | "schedule"
>;

/** The knowledge-extraction run row this script waits for, read from the Mediapulse database. */
export type ExtractionRunRow = {
  id: string;
  status: string;
  considered: number;
  entitiesCreated: number;
  relationsOpened: number;
  relationsConfirmed: number;
  mentionsWritten: number;
  kindsCreated: number;
  rejectedSpanNotInText: number;
  rejectedNameNotInText: number;
  stopReason: string | null;
  durationMs: number | null;
};

export type RunExtractionOnceOptions = {
  tickerId: string;
  symbol: string;
  limit: number;
  apply: boolean;
  waitSeconds?: number;
};

export type RunExtractionOnceResult = {
  applied: boolean;
  pipelineId: string | null;
  scheduleId: string | null;
  cleanedUp: boolean;
  run: ExtractionRunRow | null;
  timedOut: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads both domains' script environment variables.
 *
 * This script reads the Mediapulse database for the issuer and the run row, and writes the
 * orchestration database, so it needs both env files: `@mediapulse/env` validates its whole schema
 * on import and fails on any missing key, not only the database URL.
 *
 * - Important: dotenv never overwrites a variable the shell already set, so exporting
 *   `ORCHESTRATION_DATABASE_URL` and `MEDIAPULSE_DATABASE_URL` is what points this script at
 *   another environment.
 */
const loadScriptEnv = (): void => {
  const envPaths = [
    path.resolve(__dirname, "../../hermes/dashboard/.env.local"),
    path.resolve(__dirname, "../../../packages/mediapulse/env/.env"),
  ];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) {
      console.log(`No ${envPath}; relying on the environment for its values.`);

      continue;
    }

    config({ path: envPath });
    console.log(
      `Loaded ${envPath}. A variable already set in the environment keeps its value.`,
    );
  }
};

const flagValue = (name: string): string | undefined => {
  const prefixed = `--${name}`;
  const index = process.argv.indexOf(prefixed);
  if (index !== -1) {
    return process.argv[index + 1];
  }
  const inline = process.argv.find((argument) =>
    argument.startsWith(`${prefixed}=`),
  );

  return inline?.slice(prefixed.length + 1);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates the throwaway pipeline, step and due schedule for one issuer.
 *
 * @param db - Orchestration delegates.
 * @param options - Issuer and how many articles the run may read.
 * @returns Ids of the rows to remove once the run finishes.
 */
export const createOneShotRun = async (
  db: OneShotDb,
  options: Pick<RunExtractionOnceOptions, "tickerId" | "symbol" | "limit">,
): Promise<{ pipelineId: string; scheduleId: string }> => {
  const integration = await db.domainIntegration.findFirst({
    orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
    select: { id: true },
  });
  if (integration === null) {
    throw new Error(
      "No domain integration row in the orchestration database; register one first.",
    );
  }

  const name = `${ONE_SHOT_NAME_PREFIX} (${options.symbol})`;

  // A config of its own, so the throwaway step cannot be left pointing at the nightly one when this
  // deletes its rows.
  const agentConfig = await db.agentConfig.create({
    data: {
      name,
      description:
        "Created by run-extraction-once and deleted when the run finishes.",
      agentId: AGENT_ID,
      agentVersion: AGENT_VERSION,
      config: knowledgeExtractionConfig(),
    },
    select: { id: true },
  });

  const pipeline = await db.pipeline.create({
    data: {
      name,
      description: `One-shot knowledge extraction for ${options.symbol}.`,
      isActive: true,
      domainIntegrationId: integration.id,
      steps: {
        create: [
          {
            order: 0,
            agentId: AGENT_ID,
            agentVersion: AGENT_VERSION,
            agentConfigId: agentConfig.id,
            input: { tickerId: options.tickerId, limit: options.limit },
          },
        ],
      },
    },
    select: { id: true },
  });

  // Due a second ago, so the worker's next schedule check picks it up. `repeating` with a cron that
  // cannot fire again this century keeps it from running twice before cleanup removes it.
  const schedule = await db.schedule.create({
    data: {
      name,
      description: `One-shot knowledge extraction for ${options.symbol}.`,
      repeat: "repeating",
      cronExpression: "0 0 1 1 *",
      timezone: "UTC",
      nextRunAt: new Date(Date.now() - 1_000),
      priority: 0,
      enabled: true,
      pipelineId: pipeline.id,
    },
    select: { id: true },
  });

  return { pipelineId: pipeline.id, scheduleId: schedule.id };
};

/**
 * Stops the throwaway schedule from firing again, without removing anything.
 *
 * - Important: this is what runs when the wait ends with the run still going. Deleting the pipeline
 *   mid-flight cascades to the step and its execution records while the worker still holds a job
 *   against them, so the rows stay until the run is finished and an operator can see what happened.
 *
 * @param db - Orchestration delegates.
 * @param scheduleId - The throwaway schedule.
 */
export const parkOneShotRun = async (
  db: OneShotDb,
  scheduleId: string,
): Promise<void> => {
  await db.schedule.update({
    where: { id: scheduleId },
    data: { enabled: false, nextRunAt: null },
  });
};

/**
 * Removes the throwaway rows.
 *
 * Deleting the pipeline cascades to its steps and its schedule, so the agent config is the only
 * other row to clear.
 *
 * - Important: only safe once the run has finished. See {@link parkOneShotRun}.
 *
 * @param db - Orchestration delegates.
 * @param ids - What {@link createOneShotRun} created.
 */
export const cleanUpOneShotRun = async (
  db: OneShotDb,
  ids: { pipelineId: string; symbol: string },
): Promise<void> => {
  await db.pipeline.delete({ where: { id: ids.pipelineId } });
  await db.agentConfig.deleteMany({
    where: { name: `${ONE_SHOT_NAME_PREFIX} (${ids.symbol})` },
  });
};

/**
 * Waits for the extraction run row this schedule produces.
 *
 * @param findRun - Reads the newest run for this issuer that started after this script did, so an
 *   older run cannot be mistaken for this one.
 * @param waitMs - How long to keep looking.
 * @param sleepFn - Injected for tests.
 * @returns The finished run, or null when the wait ran out.
 */
export const waitForExtractionRun = async (
  findRun: () => Promise<ExtractionRunRow | null>,
  waitMs: number,
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<ExtractionRunRow | null> => {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const run = await findRun();
    if (run !== null && run.status !== "running") {
      return run;
    }
    if (Date.now() >= deadline) {
      return null;
    }
    await sleepFn(POLL_INTERVAL_MS);
  }
};

const main = async (): Promise<void> => {
  loadScriptEnv();

  const symbol = flagValue("symbol");
  const limitFlag = flagValue("limit");
  const waitFlag = flagValue("wait-seconds");
  const apply = process.argv.includes("--apply");

  if (symbol === undefined) {
    console.error(
      "Usage: run-extraction-once --symbol FORE [--limit 30] [--wait-seconds 900] [--apply]",
    );
    process.exit(1);
  }

  const limit = limitFlag === undefined ? 30 : Number.parseInt(limitFlag, 10);
  const waitSeconds =
    waitFlag === undefined
      ? DEFAULT_WAIT_SECONDS
      : Number.parseInt(waitFlag, 10);

  const orchestration = (await import("@hermes/orchestration-database")).prisma;
  const mediapulse = (await import("@mediapulse/database")).prisma;

  const ticker = await mediapulse.ticker.findUnique({
    where: { symbol },
    select: { id: true, symbol: true },
  });
  if (ticker === null) {
    throw new Error(`${symbol} does not exist in this database`);
  }

  const registered = await orchestration.agentRegistry.findFirst({
    where: { agentId: AGENT_ID, agentVersion: AGENT_VERSION, isActive: true },
    select: { id: true },
  });
  if (registered === null) {
    throw new Error(
      `No active registry entry for ${AGENT_ID}@${AGENT_VERSION}; deploy the agent first.`,
    );
  }

  const missing = await findMissingVariableKeys(orchestration);
  if (missing.length > 0) {
    throw new Error(
      `Hermes is missing ${missing.join(", ")}; the run would fail at its first model call.`,
    );
  }

  const unread = await mediapulse.dataSourceTickerSection.count({
    where: {
      tickerId: ticker.id,
      section: { not: null },
      dataSource: { knowledgeMentions: { none: { tickerId: ticker.id } } },
    },
  });

  console.log(
    `${symbol}: ${String(unread)} unread placed articles, this run reads at most ${String(limit)}.`,
  );

  if (!apply) {
    console.log("Dry run. Pass --apply to create the one-shot schedule.");

    return;
  }

  const startedAt = new Date();
  const ids = await createOneShotRun(orchestration, {
    tickerId: ticker.id,
    symbol: ticker.symbol,
    limit,
  });
  console.log(
    `Created throwaway pipeline ${ids.pipelineId} and schedule ${ids.scheduleId}. Waiting for the worker (it checks every minute).`,
  );

  let finished = false;

  try {
    const run = await waitForExtractionRun(async () => {
      const row = await mediapulse.knowledgeExtractionRun.findFirst({
        where: { tickerId: ticker.id, startedAt: { gte: startedAt } },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          considered: true,
          entitiesCreated: true,
          relationsOpened: true,
          relationsConfirmed: true,
          mentionsWritten: true,
          kindsCreated: true,
          rejectedSpanNotInText: true,
          rejectedNameNotInText: true,
          stopReason: true,
          durationMs: true,
        },
      });

      return row;
    }, waitSeconds * 1_000);

    if (run === null) {
      finished = false;
      console.log(
        `No finished run after ${String(waitSeconds)}s. The run is probably still going: the agent reads articles one at a time.`,
      );
      console.log(
        `Leaving pipeline ${ids.pipelineId} and schedule ${ids.scheduleId} in place, with the schedule switched off so it cannot fire again. Delete them once the run row is no longer 'running'.`,
      );

      return;
    }

    finished = true;
    console.log(`Run ${run.id} finished as ${run.status}:`, {
      considered: run.considered,
      entitiesCreated: run.entitiesCreated,
      relationsOpened: run.relationsOpened,
      relationsConfirmed: run.relationsConfirmed,
      mentionsWritten: run.mentionsWritten,
      kindsCreated: run.kindsCreated,
      rejectedSpanNotInText: run.rejectedSpanNotInText,
      rejectedNameNotInText: run.rejectedNameNotInText,
      durationMs: run.durationMs,
    });
    if (run.stopReason !== null) {
      console.log("stopReason:", run.stopReason);
    }
  } finally {
    if (finished) {
      await cleanUpOneShotRun(orchestration, {
        pipelineId: ids.pipelineId,
        symbol: ticker.symbol,
      });
      console.log("Removed the throwaway pipeline, step, schedule and config.");
    } else {
      await parkOneShotRun(orchestration, ids.scheduleId);
      console.log(
        "Switched the throwaway schedule off and left the rows for inspection.",
      );
    }
  }
};

const isCliEntry = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isCliEntry) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("One-shot extraction run failed", error);
      process.exit(1);
    });
}
