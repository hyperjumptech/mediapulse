/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { hashHttpTriggerToken } from "@hermes/domain-integration-crypto";

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
    agentConfigId: null,
    agentConfig: null,
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
      update: vi.fn().mockResolvedValue({}),
    },
    agentRegistry: {
      findFirst: vi.fn().mockResolvedValue({ inputSchema }),
    },
  };

  return { db, createdPipelineIds };
};

const baseOptions = (
  overrides: Partial<SeedDay1Options> = {},
): SeedDay1Options => ({
  apply: false,
  bootstrapSources: DEFAULT_BOOTSTRAP_SOURCES,
  latestIssueSources: DEFAULT_LATEST_ISSUE_SOURCES,
  rotateTokens: false,
  allowExtraAgents: false,
  disabled: false,
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

  it("writes pipeline steps and triggers with hashed tokens on apply", async () => {
    const { db } = buildDb();
    const tokens = ["token-bootstrap-0001", "token-latest-0002"];
    const generateToken = vi.fn(() => tokens.shift() ?? "unexpected");

    const result = await seedDay1NewsletterPipelines(
      baseOptions({ apply: true, generateToken }),
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
        method: "POST",
        enabled: true,
        tokenHash: hashHttpTriggerToken("token-bootstrap-0001"),
        tokenHint: "...0001",
      }),
      select: { id: true },
    });
    expect(result.triggers).toEqual([
      {
        pipelineName: "Day 1 Newsletter",
        pipelineId: "new-Day 1 Newsletter",
        triggerId: "trigger-Day 1 Newsletter",
        triggerName: "Day 1 Newsletter",
        envPrefix: "MEDIAPULSE_DAY1_BOOTSTRAP",
        token: "token-bootstrap-0001",
      },
      {
        pipelineName: "Day 1 Latest Issue",
        pipelineId: "new-Day 1 Latest Issue",
        triggerId: "trigger-Day 1 Latest Issue",
        triggerName: "Day 1 Latest Issue",
        envPrefix: "MEDIAPULSE_DAY1_LATEST_ISSUE",
        token: "token-latest-0002",
      },
    ]);
  });

  it("updates an existing day 1 pipeline in place and keeps trigger tokens", async () => {
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
    const generateToken = vi.fn(() => "never-used");

    const result = await seedDay1NewsletterPipelines(
      baseOptions({ apply: true, generateToken }),
      db as never,
    );

    expect(db.pipeline.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p-day1" } }),
    );
    expect(generateToken).not.toHaveBeenCalled();
    expect(db.httpTrigger.update).toHaveBeenCalledWith({
      where: { id: "trigger-existing" },
      data: expect.not.objectContaining({ tokenHash: expect.anything() }),
    });
    expect(result.triggers.map((trigger) => trigger.token)).toEqual([
      null,
      null,
    ]);
  });

  it("issues new tokens for existing triggers when asked to rotate", async () => {
    const { db } = buildDb({
      existingTriggers: {
        "Day 1 Newsletter": "trigger-existing",
        "Day 1 Latest Issue": "trigger-existing-latest",
      },
    });

    const result = await seedDay1NewsletterPipelines(
      baseOptions({
        apply: true,
        rotateTokens: true,
        disabled: true,
        generateToken: () => "rotated-token-9999",
      }),
      db as never,
    );

    expect(db.httpTrigger.update).toHaveBeenCalledWith({
      where: { id: "trigger-existing" },
      data: expect.objectContaining({
        enabled: false,
        tokenHash: hashHttpTriggerToken("rotated-token-9999"),
        tokenHint: "...9999",
      }),
    });
    expect(result.triggers[0]?.token).toBe("rotated-token-9999");
  });
});

describe("parseSeedDay1Args", () => {
  it("defaults to a dry run over the default source names", () => {
    expect(parseSeedDay1Args([])).toEqual({
      apply: false,
      rotateTokens: false,
      allowExtraAgents: false,
      disabled: false,
      bootstrapSources: DEFAULT_BOOTSTRAP_SOURCES,
      latestIssueSources: DEFAULT_LATEST_ISSUE_SOURCES,
    });
  });

  it("reads flags and comma separated source lists", () => {
    const options = parseSeedDay1Args([
      "--apply",
      "--rotate-tokens",
      "--disabled",
      "--allow-extra-agents",
      "--bootstrap-sources",
      "Query Analysis, Data Collection,Analysis & Newsletter",
      "--latest-sources",
      "Newsletter Delivery",
    ]);

    expect(options).toEqual({
      apply: true,
      rotateTokens: true,
      allowExtraAgents: true,
      disabled: true,
      bootstrapSources: [
        "Query Analysis",
        "Data Collection",
        "Analysis & Newsletter",
      ],
      latestIssueSources: ["Newsletter Delivery"],
    });
  });
});
