/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BOOTSTRAP_SOURCES,
  DEFAULT_LATEST_ISSUE_SOURCES,
  parseSeedDay1Args,
  seedDay1NewsletterPipelines,
  TICKER_OVERRIDE,
  type SeedDay1Options,
} from "./seed-day1-newsletter-pipelines";

const TICKER_EXPANSION = "db:userTicker:tickerId?where.enabled=true";

type FixtureStep = {
  agentId: string;
  input?: Record<string, unknown>;
  agentConfigId?: string | null;
  agentContractId?: string | null;
};

type FixturePipeline = {
  id: string;
  name: string;
  timeout: number | null;
  domainIntegrationId?: string;
  steps: FixtureStep[];
};

const nightlyPipelines = (): FixturePipeline[] => [
  {
    id: "p-query",
    name: "Query Analysis",
    timeout: 600_000,
    steps: [
      {
        agentId: "query-analysis",
        input: { tickerId: TICKER_EXPANSION },
        agentContractId: "contract-1",
      },
    ],
  },
  {
    id: "p-collect",
    name: "Data Collection",
    timeout: 900_000,
    steps: [
      { agentId: "data-collection", input: { tickerId: TICKER_EXPANSION } },
    ],
  },
  {
    id: "p-analysis",
    name: "Article Analysis",
    timeout: 1_200_000,
    steps: [{ agentId: "article-analysis", input: { limit: 200 } }],
  },
  {
    id: "p-content",
    name: "Content Generation",
    timeout: 600_000,
    steps: [
      {
        agentId: "content-generation",
        input: { tickerId: TICKER_EXPANSION },
      },
    ],
  },
  {
    id: "p-delivery",
    name: "Delivery",
    timeout: null,
    steps: [{ agentId: "delivery", input: { tickerId: TICKER_EXPANSION } }],
  },
];

const toCompositionPipeline = (pipeline: FixturePipeline) => ({
  id: pipeline.id,
  name: pipeline.name,
  timeout: pipeline.timeout,
  domainIntegrationId: pipeline.domainIntegrationId ?? "di-1",
  steps: pipeline.steps.map((step, order) => ({
    id: `${pipeline.id}-step-${order}`,
    order,
    kind: "agent",
    agentId: step.agentId,
    agentVersion: "1.0.0",
    targetPipelineId: null,
    input: step.input ?? {},
    config: {},
    agentConfigId: step.agentConfigId ?? null,
    agentConfig: step.agentConfigId ? { config: {} } : null,
    agentContractId: step.agentContractId ?? null,
    agentContract: step.agentContractId
      ? { brief: "Brief", version: "1" }
      : null,
  })),
});

type BuildDbOptions = {
  pipelines?: FixturePipeline[];
  existingTriggers?: Record<string, string>;
  inputSchema?: unknown;
};

const buildDb = ({
  pipelines = nightlyPipelines(),
  existingTriggers = {},
  inputSchema = { properties: { tickerId: { type: "string" } } },
}: BuildDbOptions = {}) => {
  const byId = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline]));
  const createdPipelineIds: string[] = [];
  const db = {
    pipeline: {
      findMany: vi.fn().mockResolvedValue(
        pipelines.map((pipeline) => ({
          id: pipeline.id,
          name: pipeline.name,
          domainIntegrationId: pipeline.domainIntegrationId ?? "di-1",
          timeout: pipeline.timeout,
        })),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const pipeline = byId.get(where.id);

        return pipeline ? toCompositionPipeline(pipeline) : null;
      }),
      create: vi.fn(async ({ data }: { data: { name: string } }) => {
        const id = `new-${data.name}`;
        createdPipelineIds.push(id);

        return { id };
      }),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
      })),
    },
    pipelineStep: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    httpTrigger: {
      findFirst: vi.fn(async ({ where }: { where: { name: string } }) => {
        const triggerId = existingTriggers[where.name];

        return triggerId ? { id: triggerId } : null;
      }),
      create: vi.fn(async ({ data }: { data: { name: string } }) => ({
        id: `trigger-${data.name}`,
      })),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
      })),
    },
    agentRegistry: {
      findFirst: vi.fn().mockResolvedValue({ inputSchema }),
    },
  };

  return { db, createdPipelineIds };
};

const productionPipelines = (): FixturePipeline[] => [
  ...nightlyPipelines().slice(0, 3),
  {
    id: "p-newsletter",
    name: "Newsletter Creation & Delivery",
    timeout: 1_800_000,
    steps: [
      {
        agentId: "content-generation",
        input: { tickerId: TICKER_EXPANSION },
        agentConfigId: "config-content",
        agentContractId: "contract-2",
      },
      {
        agentId: "delivery",
        input: { tickerId: TICKER_EXPANSION },
        agentConfigId: "config-delivery",
        agentContractId: "contract-2",
      },
    ],
  },
];

const baseOptions = (
  overrides: Partial<SeedDay1Options> = {},
): SeedDay1Options => ({
  apply: false,
  bootstrapSources: DEFAULT_BOOTSTRAP_SOURCES,
  latestIssueSources: DEFAULT_LATEST_ISSUE_SOURCES,
  allowExtraAgents: false,
  disabled: false,
  copyDeliveryFrom: null,
  ...overrides,
});

const productionOptions = (
  overrides: Partial<SeedDay1Options> = {},
): SeedDay1Options =>
  baseOptions({
    bootstrapSources: [
      "Query Analysis",
      "Data Collection",
      "Article Analysis",
      "Newsletter Creation & Delivery",
    ],
    copyDeliveryFrom: "Newsletter Creation & Delivery",
    ...overrides,
  });

describe("seedDay1NewsletterPipelines", () => {
  it("plans both pipelines on a dry run without writing", async () => {
    const { db } = buildDb();

    const result = await seedDay1NewsletterPipelines(
      baseOptions(),
      db as never,
    );

    expect(result.applied).toBe(false);
    const [bootstrap, latestIssue] = result.plans;
    expect(bootstrap?.composedSteps.map((step) => step.agentId)).toEqual([
      "query-analysis",
      "data-collection",
      "article-analysis",
      "content-generation",
      "delivery",
    ]);
    expect(
      bootstrap?.composedSteps.every(
        (step) => step.input.tickerId === TICKER_OVERRIDE.tickerId,
      ),
    ).toBe(true);
    expect(bootstrap?.composedSteps[2]?.input).toEqual({
      limit: 200,
      tickerId: "{{params.tickerId}}",
    });
    expect(bootstrap?.timeout).toBe(1_200_000);
    expect(latestIssue?.composedSteps.map((step) => step.agentId)).toEqual([
      "delivery",
    ]);
    expect(db.pipeline.create).not.toHaveBeenCalled();
    expect(db.httpTrigger.create).not.toHaveBeenCalled();
  });

  it("lists the existing pipelines when a source name does not match", async () => {
    const { db } = buildDb();

    await expect(
      seedDay1NewsletterPipelines(
        baseOptions({ latestIssueSources: ["Newsletter Delivery"] }),
        db as never,
      ),
    ).rejects.toThrow(
      /Expected exactly one pipeline named "Newsletter Delivery", found 0\. Pipelines: "Query Analysis"/,
    );
  });

  it("refuses a source whose step would still fan out after the override", async () => {
    const pipelines = nightlyPipelines();
    pipelines[2] = {
      id: "p-analysis",
      name: "Article Analysis",
      timeout: null,
      steps: [{ agentId: "article-analysis", input: { batch: "db:batch:id" } }],
    };
    const { db } = buildDb({ pipelines });

    await expect(
      seedDay1NewsletterPipelines(baseOptions(), db as never),
    ).rejects.toThrow(
      "Article Analysis › article-analysis@1.0.0 would still fan out on batch=db:batch:id",
    );
  });

  it("refuses sources that compose to a different agent sequence unless allowed", async () => {
    const { db } = buildDb();
    const options = baseOptions({
      bootstrapSources: ["Query Analysis", "Data Collection", "Delivery"],
    });

    await expect(
      seedDay1NewsletterPipelines(options, db as never),
    ).rejects.toThrow(
      '"Day 1 Newsletter" would run query-analysis → data-collection → delivery',
    );
    await expect(
      seedDay1NewsletterPipelines(
        { ...options, allowExtraAgents: true },
        db as never,
      ),
    ).resolves.toMatchObject({ applied: false });
  });

  it("refuses a query-analysis step without a contract", async () => {
    const pipelines = nightlyPipelines();
    pipelines[0] = {
      ...pipelines[0]!,
      steps: [
        { agentId: "query-analysis", input: { tickerId: TICKER_EXPANSION } },
      ],
    };
    const { db } = buildDb({ pipelines });

    await expect(
      seedDay1NewsletterPipelines(baseOptions(), db as never),
    ).rejects.toThrow("has no agent contract");
  });

  it("refuses an agent whose input schema has no tickerId", async () => {
    const { db } = buildDb({ inputSchema: { properties: { other: {} } } });

    await expect(
      seedDay1NewsletterPipelines(baseOptions(), db as never),
    ).rejects.toThrow("does not take a tickerId input");
  });

  it("refuses sources from different domain integrations", async () => {
    const pipelines = nightlyPipelines();
    pipelines[4] = { ...pipelines[4]!, domainIntegrationId: "di-2" };
    const { db } = buildDb({ pipelines });

    await expect(
      seedDay1NewsletterPipelines(baseOptions(), db as never),
    ).rejects.toThrow('"Delivery" belongs to a different domain integration');
  });

  it("writes pipeline steps and event triggers on apply", async () => {
    const { db } = buildDb();

    const result = await seedDay1NewsletterPipelines(
      baseOptions({ apply: true }),
      db as never,
    );

    expect(result.applied).toBe(true);
    expect(db.pipeline.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Day 1 Newsletter",
        isActive: true,
        timeout: 1_200_000,
        domainIntegrationId: "di-1",
      }),
      select: { id: true },
    });
    expect(db.pipelineStep.upsert).toHaveBeenCalledWith({
      where: {
        pipelineId_order: { pipelineId: "new-Day 1 Newsletter", order: 1 },
      },
      create: expect.objectContaining({
        pipelineId: "new-Day 1 Newsletter",
        order: 1,
        kind: "pipeline",
        targetPipelineId: "p-collect",
        input: { tickerId: "{{params.tickerId}}" },
      }),
      update: expect.objectContaining({
        kind: "pipeline",
        targetPipelineId: "p-collect",
        agentId: null,
      }),
    });
    expect(db.pipelineStep.deleteMany).toHaveBeenCalledWith({
      where: { pipelineId: "new-Day 1 Newsletter", order: { gte: 5 } },
    });
    expect(db.httpTrigger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Day 1 Newsletter",
        pipelineId: "new-Day 1 Newsletter",
        enabled: true,
        authType: "DOMAIN_EVENT",
        eventName: "day1.full-chain",
        tokenHash: null,
        tokenHint: null,
      }),
      select: { id: true },
    });
    expect(result.triggers).toEqual([
      {
        pipelineName: "Day 1 Newsletter",
        pipelineId: "new-Day 1 Newsletter",
        triggerId: "trigger-Day 1 Newsletter",
        triggerName: "Day 1 Newsletter",
        eventName: "day1.full-chain",
      },
      {
        pipelineName: "Day 1 Latest Issue",
        pipelineId: "new-Day 1 Latest Issue",
        triggerId: "trigger-Day 1 Latest Issue",
        triggerName: "Day 1 Latest Issue",
        eventName: "day1.latest-issue",
      },
    ]);
  });

  it("composes a combined newsletter and delivery source into the full chain", async () => {
    const combinedPipeline: FixturePipeline = {
      id: "p-newsletter",
      name: "Newsletter Creation & Delivery",
      timeout: 900_000,
      steps: [
        {
          agentId: "content-generation",
          input: { tickerId: TICKER_EXPANSION },
        },
        { agentId: "delivery", input: { tickerId: TICKER_EXPANSION } },
      ],
    };
    const pipelines = [...nightlyPipelines().slice(0, 3), combinedPipeline];
    const { db } = buildDb({ pipelines });

    const result = await seedDay1NewsletterPipelines(
      baseOptions({
        bootstrapSources: [
          "Query Analysis",
          "Data Collection",
          "Article Analysis",
          "Newsletter Creation & Delivery",
        ],
        latestIssueSources: [],
      }),
      db as never,
    );
    const [bootstrap] = result.plans;

    expect(bootstrap?.composedSteps.map((step) => step.agentId)).toEqual([
      "query-analysis",
      "data-collection",
      "article-analysis",
      "content-generation",
      "delivery",
    ]);
  });

  it("plans a copied delivery pipeline for the latest issue on a dry run", async () => {
    const { db } = buildDb({ pipelines: productionPipelines() });

    const result = await seedDay1NewsletterPipelines(
      productionOptions(),
      db as never,
    );
    const [, latestIssue] = result.plans;

    expect(result.deliveryPipeline?.existingPipelineId).toBeNull();
    expect(result.deliveryPipeline?.deliveryStep).toEqual(
      expect.objectContaining({
        agentId: "delivery",
        agentVersion: "1.0.0",
        agentConfigId: "config-delivery",
        agentContractId: "contract-2",
      }),
    );
    expect(latestIssue?.composedSteps.map((step) => step.agentId)).toEqual([
      "delivery",
    ]);
    expect(latestIssue?.composedSteps[0]?.input).toEqual({
      tickerId: "{{params.tickerId}}",
    });
    expect(db.pipeline.create).not.toHaveBeenCalled();
    expect(db.pipelineStep.upsert).not.toHaveBeenCalled();
  });

  it("writes the copied delivery pipeline and points the latest issue at it", async () => {
    const { db } = buildDb({ pipelines: productionPipelines() });

    const result = await seedDay1NewsletterPipelines(
      productionOptions({ apply: true }),
      db as never,
    );

    expect(db.pipeline.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Delivery",
        timeout: 1_800_000,
        domainIntegrationId: "di-1",
      }),
      select: { id: true },
    });
    expect(db.pipelineStep.upsert).toHaveBeenCalledWith({
      where: { pipelineId_order: { pipelineId: "new-Delivery", order: 0 } },
      create: expect.objectContaining({
        pipelineId: "new-Delivery",
        order: 0,
        kind: "agent",
        agentId: "delivery",
        agentVersion: "1.0.0",
        agentConfigId: "config-delivery",
        agentContractId: "contract-2",
        input: { tickerId: TICKER_EXPANSION },
      }),
      update: expect.objectContaining({ agentId: "delivery" }),
    });
    expect(db.pipelineStep.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pipelineId_order: { pipelineId: "new-Day 1 Latest Issue", order: 0 },
        },
        create: expect.objectContaining({
          kind: "pipeline",
          targetPipelineId: "new-Delivery",
        }),
      }),
    );
    expect(result.triggers.map((trigger) => trigger.eventName)).toEqual([
      "day1.full-chain",
      "day1.latest-issue",
    ]);
  });

  it("refuses to copy from a pipeline without exactly one delivery step", async () => {
    const { db } = buildDb({ pipelines: productionPipelines() });

    await expect(
      seedDay1NewsletterPipelines(
        productionOptions({ copyDeliveryFrom: "Article Analysis" }),
        db as never,
      ),
    ).rejects.toThrow(/has 0 delivery steps/);
  });

  it("refuses to overwrite a Delivery pipeline that runs other agents", async () => {
    const pipelines = [
      ...productionPipelines(),
      {
        id: "p-other-delivery",
        name: "Delivery",
        timeout: null,
        steps: [{ agentId: "content-generation" }],
      },
    ];
    const { db } = buildDb({ pipelines });

    await expect(
      seedDay1NewsletterPipelines(productionOptions(), db as never),
    ).rejects.toThrow(/already exists with steps other than delivery/);
  });

  it("skips a day 1 pipeline that has no source pipelines", async () => {
    const { db } = buildDb();

    const result = await seedDay1NewsletterPipelines(
      baseOptions({ apply: true, latestIssueSources: [] }),
      db as never,
    );

    expect(result.plans.map((plan) => plan.definition.pipelineName)).toEqual([
      "Day 1 Newsletter",
    ]);
    expect(result.skippedPipelineNames).toEqual(["Day 1 Latest Issue"]);
    expect(result.triggers.map((trigger) => trigger.eventName)).toEqual([
      "day1.full-chain",
    ]);
    expect(db.pipeline.create).toHaveBeenCalledTimes(1);
    expect(db.httpTrigger.create).toHaveBeenCalledTimes(1);
  });

  it("updates an existing day 1 pipeline and trigger in place", async () => {
    const pipelines = [
      ...nightlyPipelines(),
      { id: "p-day1", name: "Day 1 Newsletter", timeout: null, steps: [] },
    ];
    const { db } = buildDb({
      pipelines,
      existingTriggers: {
        "Day 1 Newsletter": "trigger-existing",
        "Day 1 Latest Issue": "trigger-existing-latest",
      },
    });

    const result = await seedDay1NewsletterPipelines(
      baseOptions({ apply: true, disabled: true }),
      db as never,
    );

    expect(db.pipeline.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p-day1" } }),
    );
    expect(db.httpTrigger.create).not.toHaveBeenCalled();
    expect(db.httpTrigger.update).toHaveBeenCalledWith({
      where: { id: "trigger-existing" },
      data: expect.objectContaining({
        enabled: false,
        authType: "DOMAIN_EVENT",
        eventName: "day1.full-chain",
      }),
      select: { id: true },
    });
    expect(result.triggers.map((trigger) => trigger.triggerId)).toEqual([
      "trigger-existing",
      "trigger-existing-latest",
    ]);
  });
});

describe("parseSeedDay1Args", () => {
  it("defaults to a dry run over the default source names", () => {
    expect(parseSeedDay1Args([])).toEqual({
      apply: false,
      allowExtraAgents: false,
      disabled: false,
      bootstrapSources: DEFAULT_BOOTSTRAP_SOURCES,
      latestIssueSources: DEFAULT_LATEST_ISSUE_SOURCES,
      copyDeliveryFrom: null,
    });
  });

  it("reads flags and comma separated source lists", () => {
    const options = parseSeedDay1Args([
      "--apply",
      "--disabled",
      "--allow-extra-agents",
      "--bootstrap-sources",
      "Query Analysis, Data Collection,Analysis & Newsletter",
      "--latest-sources",
      "Newsletter Delivery",
    ]);

    expect(options).toEqual({
      apply: true,
      allowExtraAgents: true,
      disabled: true,
      bootstrapSources: [
        "Query Analysis",
        "Data Collection",
        "Analysis & Newsletter",
      ],
      latestIssueSources: ["Newsletter Delivery"],
      copyDeliveryFrom: null,
    });
  });

  it("reads the pipeline to copy the delivery step from", () => {
    const options = parseSeedDay1Args([
      "--copy-delivery-from",
      "Newsletter Creation & Delivery",
    ]);

    expect(options.copyDeliveryFrom).toBe("Newsletter Creation & Delivery");
  });

  it("drops the latest issue sources with --skip-latest-issue", () => {
    const options = parseSeedDay1Args([
      "--latest-sources",
      "Newsletter Delivery",
      "--skip-latest-issue",
    ]);

    expect(options.latestIssueSources).toEqual([]);
  });
});
