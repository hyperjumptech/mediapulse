import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Prisma } from "@hermes/orchestration-database";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";
import { createCompositionPipelineLoader } from "@hermes/scheduler/load-composition-pipeline";
import {
  resolvePipelineComposition,
  type ComposedAgentStep,
  type CompositionPipeline,
} from "@hermes/scheduler/resolve-pipeline-composition";

export const TICKER_OVERRIDE = { tickerId: "{{params.tickerId}}" } as const;

export const BOOTSTRAP_AGENT_IDS = [
  "query-analysis",
  "data-collection",
  "article-analysis",
  "content-generation",
  "delivery",
] as const;

export const LATEST_ISSUE_AGENT_IDS = ["delivery"] as const;

export const CONTRACT_REQUIRED_AGENT_IDS = ["query-analysis"] as const;

export const DEFAULT_BOOTSTRAP_SOURCES = [
  "Query Analysis",
  "Data Collection",
  "Article Analysis",
  "Content Generation",
  "Delivery",
];

export const DEFAULT_LATEST_ISSUE_SOURCES = ["Delivery"];

export const DAY1_FULL_CHAIN_EVENT = "day1.full-chain";
export const DAY1_LATEST_ISSUE_EVENT = "day1.latest-issue";

export type Day1PipelineDefinition = {
  pipelineName: string;
  description: string;
  triggerName: string;
  eventName: string;
  sourceNames: string[];
  expectedAgentIds: readonly string[];
};

export const buildDay1PipelineDefinitions = (sources: {
  bootstrapSources: string[];
  latestIssueSources: string[];
}): Day1PipelineDefinition[] => [
  {
    pipelineName: "Day 1 Newsletter",
    description:
      "Runs the whole newsletter chain for one ticker right after its first subscription is confirmed.",
    triggerName: "Day 1 Newsletter",
    eventName: DAY1_FULL_CHAIN_EVENT,
    sourceNames: sources.bootstrapSources,
    expectedAgentIds: BOOTSTRAP_AGENT_IDS,
  },
  {
    pipelineName: "Day 1 Latest Issue",
    description:
      "Sends a ticker's latest issue to subscribers who have not received it, right after a subscription is confirmed.",
    triggerName: "Day 1 Latest Issue",
    eventName: DAY1_LATEST_ISSUE_EVENT,
    sourceNames: sources.latestIssueSources,
    expectedAgentIds: LATEST_ISSUE_AGENT_IDS,
  },
];

export type SeedDay1Db = Pick<
  PrismaClientWithSchema,
  "pipeline" | "pipelineStep" | "httpTrigger" | "agentRegistry"
>;

export type SeedDay1Options = {
  apply: boolean;
  bootstrapSources: string[];
  latestIssueSources: string[];
  allowExtraAgents: boolean;
  disabled: boolean;
};

type SourcePipeline = {
  id: string;
  name: string;
  domainIntegrationId: string;
  timeout: number | null;
};

export type PlannedDay1Pipeline = {
  definition: Day1PipelineDefinition;
  existingPipelineId: string | null;
  domainIntegrationId: string;
  timeout: number | null;
  sources: SourcePipeline[];
  composedSteps: ComposedAgentStep[];
};

export type AppliedDay1Trigger = {
  pipelineName: string;
  pipelineId: string;
  triggerId: string;
  triggerName: string;
  eventName: string;
};

export type SeedDay1Result = {
  applied: boolean;
  plans: PlannedDay1Pipeline[];
  skippedPipelineNames: string[];
  triggers: AppliedDay1Trigger[];
};

const findSourcePipelines = (
  allPipelines: SourcePipeline[],
  sourceNames: string[],
): SourcePipeline[] =>
  sourceNames.map((sourceName) => {
    const matches = allPipelines.filter(
      (pipeline) => pipeline.name === sourceName,
    );
    if (matches.length !== 1) {
      const availableNames = allPipelines
        .map((pipeline) => `"${pipeline.name}"`)
        .join(", ");
      throw new Error(
        `Expected exactly one pipeline named "${sourceName}", found ${matches.length}. Pipelines: ${availableNames}`,
      );
    }
    const [match] = matches;
    if (!match) {
      throw new Error(`Pipeline "${sourceName}" disappeared while planning.`);
    }

    return match;
  });

const maxTimeout = (sources: SourcePipeline[]): number | null => {
  const timeouts = sources
    .map((source) => source.timeout)
    .filter((timeout): timeout is number => timeout != null);

  return timeouts.length > 0 ? Math.max(...timeouts) : null;
};

const findLeftoverExpansions = (step: ComposedAgentStep): string[] =>
  Object.entries(step.input)
    .filter(([, value]) => typeof value === "string" && value.startsWith("db:"))
    .map(([key, value]) => `${key}=${String(value)}`);

const describeStep = (step: ComposedAgentStep): string =>
  `${step.sourcePipeline.name} › ${step.agentId}@${step.agentVersion}`;

const assertComposedSteps = async (
  db: SeedDay1Db,
  plan: PlannedDay1Pipeline,
  allowExtraAgents: boolean,
): Promise<void> => {
  const { definition, composedSteps, domainIntegrationId } = plan;
  const agentIds = composedSteps.map((step) => step.agentId);
  const matchesExpected =
    agentIds.length === definition.expectedAgentIds.length &&
    agentIds.every(
      (agentId, index) => agentId === definition.expectedAgentIds[index],
    );
  if (!matchesExpected && !allowExtraAgents) {
    throw new Error(
      `"${definition.pipelineName}" would run ${agentIds.join(" → ")}, expected ${definition.expectedAgentIds.join(" → ")}. Pick other source pipelines or pass --allow-extra-agents.`,
    );
  }

  for (const step of composedSteps) {
    const leftoverExpansions = findLeftoverExpansions(step);
    if (leftoverExpansions.length > 0) {
      throw new Error(
        `${describeStep(step)} would still fan out on ${leftoverExpansions.join(", ")}. A day-1 run must be scoped to one ticker.`,
      );
    }
    const requiresContract = (
      CONTRACT_REQUIRED_AGENT_IDS as readonly string[]
    ).includes(step.agentId);
    if (requiresContract && step.agentContractId == null) {
      throw new Error(
        `${describeStep(step)} has no agent contract, and this agent refuses to run without one.`,
      );
    }
  }

  const agentKeys = [
    ...new Map(
      composedSteps.map((step) => [
        `${step.agentId}@${step.agentVersion}`,
        step,
      ]),
    ).values(),
  ];
  for (const step of agentKeys) {
    const registered = await db.agentRegistry.findFirst({
      where: {
        agentId: step.agentId,
        agentVersion: step.agentVersion,
        domainIntegrationId,
        isActive: true,
      },
      select: { inputSchema: true },
    });
    if (!registered) {
      throw new Error(
        `${step.agentId}@${step.agentVersion} is not registered and active for this domain integration.`,
      );
    }
    const inputSchema = registered.inputSchema as {
      properties?: Record<string, unknown>;
    } | null;
    const acceptsTickerId =
      inputSchema?.properties != null && "tickerId" in inputSchema.properties;
    if (!acceptsTickerId) {
      throw new Error(
        `${step.agentId}@${step.agentVersion} does not take a tickerId input, so the override cannot scope it.`,
      );
    }
  }
};

const planDay1Pipeline = async (
  db: SeedDay1Db,
  allPipelines: SourcePipeline[],
  definition: Day1PipelineDefinition,
): Promise<PlannedDay1Pipeline> => {
  const sources = findSourcePipelines(allPipelines, definition.sourceNames);
  const [firstSource] = sources;
  if (!firstSource) {
    throw new Error(`"${definition.pipelineName}" needs at least one source.`);
  }
  const domainIntegrationId = firstSource.domainIntegrationId;
  const foreignSource = sources.find(
    (source) => source.domainIntegrationId !== domainIntegrationId,
  );
  if (foreignSource) {
    throw new Error(
      `"${foreignSource.name}" belongs to a different domain integration than "${firstSource.name}".`,
    );
  }
  const existingPipeline =
    allPipelines.find(
      (pipeline) => pipeline.name === definition.pipelineName,
    ) ?? null;
  const timeout = maxTimeout(sources);
  const root: CompositionPipeline = {
    id: existingPipeline?.id ?? `planned:${definition.pipelineName}`,
    name: definition.pipelineName,
    timeout,
    domainIntegrationId,
    steps: sources.map((source, index) => ({
      id: `planned:${definition.pipelineName}:${index}`,
      order: index,
      kind: "pipeline",
      agentId: null,
      agentVersion: null,
      targetPipelineId: source.id,
      input: { ...TICKER_OVERRIDE },
    })),
  };
  const composition = await resolvePipelineComposition({
    root,
    loadPipeline: createCompositionPipelineLoader(db),
  });
  if (composition.errors.length > 0) {
    const messages = composition.errors.map((error) => error.message);
    throw new Error(
      `"${definition.pipelineName}" cannot be composed: ${messages.join("; ")}`,
    );
  }

  return {
    definition,
    existingPipelineId: existingPipeline?.id ?? null,
    domainIntegrationId,
    timeout,
    sources,
    composedSteps: composition.steps,
  };
};

const writeDay1Pipeline = async (
  db: SeedDay1Db,
  plan: PlannedDay1Pipeline,
): Promise<string> => {
  const pipelineData = {
    name: plan.definition.pipelineName,
    description: plan.definition.description,
    isActive: true,
    timeout: plan.timeout,
    domainIntegrationId: plan.domainIntegrationId,
  };
  const pipeline =
    plan.existingPipelineId === null
      ? await db.pipeline.create({ data: pipelineData, select: { id: true } })
      : await db.pipeline.update({
          where: { id: plan.existingPipelineId },
          data: pipelineData,
          select: { id: true },
        });
  const overrideInput: Prisma.InputJsonValue = { ...TICKER_OVERRIDE };
  for (const [order, source] of plan.sources.entries()) {
    const stepData = {
      kind: "pipeline" as const,
      targetPipelineId: source.id,
      agentId: null,
      agentVersion: null,
      agentConfigId: null,
      agentContractId: null,
      input: overrideInput,
      config: {},
    };
    await db.pipelineStep.upsert({
      where: { pipelineId_order: { pipelineId: pipeline.id, order } },
      create: { pipelineId: pipeline.id, order, ...stepData },
      update: stepData,
    });
  }
  await db.pipelineStep.deleteMany({
    where: { pipelineId: pipeline.id, order: { gte: plan.sources.length } },
  });

  return pipeline.id;
};

const writeDay1Trigger = async (
  db: SeedDay1Db,
  plan: PlannedDay1Pipeline,
  pipelineId: string,
  options: SeedDay1Options,
): Promise<AppliedDay1Trigger> => {
  const { definition } = plan;
  const existingTrigger = await db.httpTrigger.findFirst({
    where: { name: definition.triggerName, pipelineId },
    select: { id: true },
  });
  const triggerData = {
    name: definition.triggerName,
    description: definition.description,
    pipelineId,
    enabled: !options.disabled,
    method: "POST" as const,
    authType: "DOMAIN_EVENT" as const,
    eventName: definition.eventName,
    tokenHash: null,
    tokenHint: null,
  };
  const trigger =
    existingTrigger === null
      ? await db.httpTrigger.create({
          data: triggerData,
          select: { id: true },
        })
      : await db.httpTrigger.update({
          where: { id: existingTrigger.id },
          data: triggerData,
          select: { id: true },
        });

  return {
    pipelineName: definition.pipelineName,
    pipelineId,
    triggerId: trigger.id,
    triggerName: definition.triggerName,
    eventName: definition.eventName,
  };
};

export const seedDay1NewsletterPipelines = async (
  options: SeedDay1Options,
  db?: SeedDay1Db,
): Promise<SeedDay1Result> => {
  const targetDb =
    db ?? (await import("@hermes/orchestration-database")).prisma;
  const allPipelines = await targetDb.pipeline.findMany({
    select: { id: true, name: true, domainIntegrationId: true, timeout: true },
    orderBy: { name: "asc" },
  });
  const allDefinitions = buildDay1PipelineDefinitions(options);
  const definitions = allDefinitions.filter(
    (definition) => definition.sourceNames.length > 0,
  );
  const skippedPipelineNames = allDefinitions
    .filter((definition) => definition.sourceNames.length === 0)
    .map((definition) => definition.pipelineName);
  const plans: PlannedDay1Pipeline[] = [];
  for (const definition of definitions) {
    const plan = await planDay1Pipeline(targetDb, allPipelines, definition);
    await assertComposedSteps(targetDb, plan, options.allowExtraAgents);
    plans.push(plan);
  }
  if (!options.apply) {
    return { applied: false, plans, skippedPipelineNames, triggers: [] };
  }

  const triggers: AppliedDay1Trigger[] = [];
  for (const plan of plans) {
    const pipelineId = await writeDay1Pipeline(targetDb, plan);
    triggers.push(await writeDay1Trigger(targetDb, plan, pipelineId, options));
  }

  return { applied: true, plans, skippedPipelineNames, triggers };
};

const readListFlag = (
  argv: string[],
  flag: string,
  fallback: string[],
): string[] => {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  if (value === undefined) {
    return fallback;
  }

  return value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
};

export const parseSeedDay1Args = (argv: string[]): SeedDay1Options => ({
  apply: argv.includes("--apply"),
  allowExtraAgents: argv.includes("--allow-extra-agents"),
  disabled: argv.includes("--disabled"),
  bootstrapSources: readListFlag(
    argv,
    "--bootstrap-sources",
    DEFAULT_BOOTSTRAP_SOURCES,
  ),
  latestIssueSources: argv.includes("--skip-latest-issue")
    ? []
    : readListFlag(argv, "--latest-sources", DEFAULT_LATEST_ISSUE_SOURCES),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadHermesScriptEnv = (): void => {
  const envPath = path.resolve(__dirname, "../../hermes/dashboard/.env.local");
  if (!fs.existsSync(envPath)) {
    console.log(
      `No ${envPath}. Relying on the environment for ORCHESTRATION_DATABASE_URL.`,
    );

    return;
  }
  config({ path: envPath });
  console.log(
    `Loaded ${envPath}. A variable already set in the environment keeps its value.`,
  );
};

const printPlan = (plan: PlannedDay1Pipeline): void => {
  const action = plan.existingPipelineId === null ? "create" : "update";
  console.log(`\n${plan.definition.pipelineName} (${action})`);
  for (const step of plan.composedSteps) {
    console.log(`  ${step.position + 1}. ${describeStep(step)}`);
  }
};

const printTrigger = (trigger: AppliedDay1Trigger): void => {
  console.log(
    `${trigger.triggerName}: trigger ${trigger.triggerId} runs "${trigger.pipelineName}" on event ${trigger.eventName}`,
  );
};

const main = async (): Promise<void> => {
  loadHermesScriptEnv();
  const options = parseSeedDay1Args(process.argv.slice(2));
  const result = await seedDay1NewsletterPipelines(options);
  for (const plan of result.plans) {
    printPlan(plan);
  }
  for (const pipelineName of result.skippedPipelineNames) {
    console.log(`\n${pipelineName} (skipped, no source pipelines)`);
  }
  if (!result.applied) {
    console.log("\nDry run. Pass --apply to write.");

    return;
  }
  for (const trigger of result.triggers) {
    printTrigger(trigger);
  }
  console.log(
    "\nagent-data-api sends these events when a subscription becomes active. Nothing else to configure.",
  );
};

const isCliEntry = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isCliEntry) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Failed to seed the day 1 newsletter pipelines", error);
      process.exit(1);
    });
}
