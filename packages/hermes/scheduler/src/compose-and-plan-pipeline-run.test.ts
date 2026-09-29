/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { composeAndPlanPipelineRun } from "./compose-and-plan-pipeline-run";
import type {
  CompositionPipeline,
  CompositionPipelineStep,
} from "./resolve-pipeline-composition";

const registryAgent = (agentId: string) => ({
  agentId,
  agentVersion: "1.0.0",
  endpoint: { url: `https://${agentId}.example/run`, method: "POST" },
  isActive: true,
  inputSchema: null,
  configSchema: null,
});

const createDb = () => ({
  variable: { findMany: vi.fn().mockResolvedValue([]) },
  agentRegistry: {
    findMany: vi
      .fn()
      .mockResolvedValue([
        registryAgent("collect"),
        registryAgent("send"),
        registryAgent("prepare"),
      ]),
  },
});

const agentStep = (
  id: string,
  order: number,
  agentId: string,
  input: Record<string, unknown> = {},
): CompositionPipelineStep => ({
  id,
  order,
  kind: "agent",
  agentId,
  agentVersion: "1.0.0",
  targetPipelineId: null,
  input,
  config: {},
  agentConfigId: null,
  agentConfig: null,
  agentContractId: null,
  agentContract: null,
});

const pipelineStep = (
  id: string,
  order: number,
  targetPipelineId: string,
  input: Record<string, unknown>,
): CompositionPipelineStep => ({
  id,
  order,
  kind: "pipeline",
  agentId: null,
  agentVersion: null,
  targetPipelineId,
  input,
});

const collection: CompositionPipeline = {
  id: "collection",
  name: "Collection",
  timeout: 900_000,
  domainIntegrationId: "di-1",
  steps: [agentStep("collect-step", 0, "collect", { itemId: "db:item:id" })],
};

const delivery: CompositionPipeline = {
  id: "delivery",
  name: "Delivery",
  timeout: null,
  domainIntegrationId: "di-1",
  steps: [agentStep("send-step", 0, "send", { itemId: "db:item:id" })],
};

const root: CompositionPipeline = {
  id: "root",
  name: "Root",
  timeout: 120_000,
  domainIntegrationId: "di-1",
  steps: [
    agentStep("prepare-step", 0, "prepare"),
    pipelineStep("include-collection", 1, "collection", {
      itemId: "{{params.itemId}}",
    }),
    pipelineStep("include-delivery", 2, "delivery", {
      itemId: "{{params.itemId}}",
    }),
  ],
};

const loadPipeline = async (pipelineId: string) =>
  [collection, delivery].find((item) => item.id === pipelineId) ?? null;

const expandStepInputs = async (context: {
  input: Record<string, unknown>;
}) => [context.input];

describe("composeAndPlanPipelineRun", () => {
  it("plans one wave per composed step with overrides, positions and per-pipeline timeouts", async () => {
    const result = await composeAndPlanPipelineRun({
      db: createDb() as never,
      root,
      loadPipeline,
      defaultTimeoutMs: 300_000,
      sourceId: "trigger-1",
      expandStepInputs,
      runParams: { itemId: "item-7" },
    });

    expect(result.errors).toEqual([]);
    const planned = result.waveList.map((wave) => wave[0]);
    expect(planned.map((job) => job?.pipelineStepId)).toEqual([
      "prepare-step",
      "collect-step",
      "send-step",
    ]);
    expect(planned.map((job) => job?.position)).toEqual([0, 1, 2]);
    expect(planned.map((job) => job?.timeoutMs)).toEqual([
      120_000, 900_000, 120_000,
    ]);
    expect(planned[1]?.input).toEqual({ itemId: "item-7" });
    expect(planned[2]?.input).toEqual({ itemId: "item-7" });
    expect(result.composedSteps.map((step) => step.id)).toEqual([
      "prepare-step",
      "collect-step",
      "send-step",
    ]);
  });

  it("falls back to the default timeout when no pipeline sets one", async () => {
    const result = await composeAndPlanPipelineRun({
      db: createDb() as never,
      root: { ...root, timeout: null },
      loadPipeline,
      defaultTimeoutMs: 300_000,
      sourceId: "trigger-1",
      expandStepInputs,
      runParams: { itemId: "item-7" },
    });

    expect(result.waveList[2]?.[0]?.timeoutMs).toBe(300_000);
  });

  it("returns composition errors as planning diagnostics without planning anything", async () => {
    const db = createDb();
    const result = await composeAndPlanPipelineRun({
      db: db as never,
      root: {
        ...root,
        steps: [pipelineStep("missing", 0, "gone", {})],
      },
      loadPipeline,
      defaultTimeoutMs: 300_000,
      sourceId: "trigger-1",
      expandStepInputs,
    });

    expect(result.waveList).toEqual([]);
    expect(result.composedSteps).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({
        phase: "planning",
        pipelineStepId: "missing",
        message: expect.stringContaining("no longer exists"),
      }),
    ]);
    expect(db.agentRegistry.findMany).not.toHaveBeenCalled();
  });
});
