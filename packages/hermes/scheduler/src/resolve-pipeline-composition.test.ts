import { describe, expect, it } from "vitest";

import {
  resolvePipelineComposition,
  type CompositionPipeline,
  type CompositionPipelineStep,
} from "./resolve-pipeline-composition";

const agentStep = (
  id: string,
  order: number,
  overrides: Partial<CompositionPipelineStep> = {},
): CompositionPipelineStep => ({
  id,
  order,
  kind: "agent",
  agentId: `agent-${id}`,
  agentVersion: "1.0.0",
  targetPipelineId: null,
  input: {},
  config: {},
  agentConfigId: null,
  agentConfig: null,
  agentContractId: null,
  agentContract: null,
  ...overrides,
});

const pipelineStep = (
  id: string,
  order: number,
  targetPipelineId: string,
  input: Record<string, unknown> = {},
): CompositionPipelineStep => ({
  id,
  order,
  kind: "pipeline",
  agentId: null,
  agentVersion: null,
  targetPipelineId,
  input,
  config: {},
});

const pipeline = (
  id: string,
  steps: CompositionPipelineStep[],
  overrides: Partial<CompositionPipeline> = {},
): CompositionPipeline => ({
  id,
  name: `Pipeline ${id}`,
  timeout: null,
  domainIntegrationId: "di-1",
  steps,
  ...overrides,
});

const loaderFor = (pipelines: CompositionPipeline[]) => {
  const byId = new Map(pipelines.map((item) => [item.id, item]));

  return async (pipelineId: string) => byId.get(pipelineId) ?? null;
};

describe("resolvePipelineComposition", () => {
  it("returns agent steps of a plain pipeline in order with positions", async () => {
    const root = pipeline("root", [agentStep("b", 1), agentStep("a", 0)]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([]),
    });

    expect(result.errors).toEqual([]);
    expect(result.steps.map((step) => [step.id, step.position])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    expect(result.steps[0]?.sourcePipeline).toEqual({
      id: "root",
      name: "Pipeline root",
      timeout: null,
    });
    expect(result.steps[0]?.includedVia).toEqual([]);
  });

  it("inlines target pipelines in place and keeps each step's source pipeline", async () => {
    const collection = pipeline("collection", [agentStep("collect", 0)], {
      name: "Collection",
      timeout: 900_000,
    });
    const newsletter = pipeline(
      "newsletter",
      [agentStep("write", 0), agentStep("send", 1)],
      { name: "Newsletter" },
    );
    const root = pipeline("root", [
      agentStep("first", 0),
      pipelineStep("include-collection", 1, "collection"),
      pipelineStep("include-newsletter", 2, "newsletter"),
    ]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([collection, newsletter]),
    });

    expect(result.errors).toEqual([]);
    expect(result.steps.map((step) => step.id)).toEqual([
      "first",
      "collect",
      "write",
      "send",
    ]);
    expect(result.steps.map((step) => step.position)).toEqual([0, 1, 2, 3]);
    expect(result.steps[1]?.sourcePipeline).toEqual({
      id: "collection",
      name: "Collection",
      timeout: 900_000,
    });
    expect(result.steps[1]?.includedVia).toEqual([
      {
        pipelineStepId: "include-collection",
        pipelineId: "collection",
        pipelineName: "Collection",
      },
    ]);
  });

  it("merges overrides into every inlined step input with the outermost value winning", async () => {
    const leaf = pipeline("leaf", [
      agentStep("leaf-step", 0, {
        input: { itemId: "db:item:id", limit: 5, mode: "leaf" },
      }),
    ]);
    const middle = pipeline("middle", [
      pipelineStep("include-leaf", 0, "leaf", {
        itemId: "from-middle",
        mode: "middle",
      }),
    ]);
    const root = pipeline("root", [
      pipelineStep("include-middle", 0, "middle", {
        itemId: "{{params.itemId}}",
      }),
    ]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([leaf, middle]),
    });

    expect(result.errors).toEqual([]);
    expect(result.steps[0]?.input).toEqual({
      itemId: "{{params.itemId}}",
      limit: 5,
      mode: "middle",
    });
  });

  it("keeps the inlined step's own config, saved config and contract", async () => {
    const contract = { brief: "Brief", version: "1" };
    const child = pipeline("child", [
      agentStep("child-step", 0, {
        config: { depth: 2 },
        agentConfigId: "cfg-1",
        agentConfig: { config: { saved: true } },
        agentContractId: "contract-1",
        agentContract: contract,
      }),
    ]);
    const root = pipeline("root", [pipelineStep("include", 0, "child")]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([child]),
    });

    expect(result.steps[0]).toMatchObject({
      config: { depth: 2 },
      agentConfigId: "cfg-1",
      agentConfig: { config: { saved: true } },
      agentContractId: "contract-1",
      agentContract: contract,
    });
  });

  it("rejects a pipeline cycle and returns no steps", async () => {
    const first = pipeline("first", [pipelineStep("to-second", 0, "second")], {
      name: "First",
    });
    const second = pipeline("second", [pipelineStep("to-first", 0, "first")], {
      name: "Second",
    });
    const root = pipeline("root", [
      agentStep("ok", 0),
      pipelineStep("to-first-from-root", 1, "first"),
    ]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([first, second]),
    });

    expect(result.steps).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      pipelineStepId: "to-first",
      message: expect.stringContaining("First › Second › First"),
    });
  });

  it("rejects a pipeline that includes itself", async () => {
    const root = pipeline("root", [pipelineStep("self", 0, "root")], {
      name: "Root",
    });

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([root]),
    });

    expect(result.errors[0]?.message).toContain("Root › Root");
  });

  it("rejects nesting deeper than the limit", async () => {
    const level3 = pipeline("level3", [agentStep("deep", 0)]);
    const level2 = pipeline("level2", [pipelineStep("to-3", 0, "level3")]);
    const level1 = pipeline("level1", [pipelineStep("to-2", 0, "level2")]);
    const root = pipeline("root", [pipelineStep("to-1", 0, "level1")]);

    const allowed = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([level1, level2, level3]),
      maxDepth: 3,
    });
    const rejected = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([level1, level2, level3]),
      maxDepth: 2,
    });

    expect(allowed.errors).toEqual([]);
    expect(allowed.steps.map((step) => step.id)).toEqual(["deep"]);
    expect(rejected.errors[0]).toMatchObject({
      pipelineStepId: "to-3",
      message: expect.stringContaining("more than 2 levels deep"),
    });
  });

  it("rejects the same step reached twice through two inclusions", async () => {
    const shared = pipeline("shared", [agentStep("shared-step", 0)]);
    const root = pipeline("root", [
      pipelineStep("first-include", 0, "shared"),
      pipelineStep("second-include", 1, "shared"),
    ]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([shared]),
    });

    expect(result.steps).toEqual([]);
    expect(result.errors[0]).toMatchObject({
      pipelineStepId: "shared-step",
      message: expect.stringContaining("reached more than once"),
    });
  });

  it("rejects a target pipeline from another domain integration", async () => {
    const foreign = pipeline("foreign", [agentStep("x", 0)], {
      name: "Foreign",
      domainIntegrationId: "di-2",
    });
    const root = pipeline("root", [pipelineStep("include", 0, "foreign")]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([foreign]),
    });

    expect(result.errors[0]?.message).toContain(
      'pipeline "Foreign", which belongs to a different domain integration',
    );
  });

  it("rejects a missing target and a pipeline step without a target", async () => {
    const root = pipeline("root", [
      pipelineStep("gone", 0, "does-not-exist"),
      { ...pipelineStep("no-target", 1, "x"), targetPipelineId: null },
    ]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([]),
    });

    expect(result.errors.map((error) => error.pipelineStepId)).toEqual([
      "gone",
      "no-target",
    ]);
    expect(result.errors[0]?.message).toContain("no longer exists");
    expect(result.errors[1]?.message).toContain("does not point at a pipeline");
  });

  it("rejects an agent step without an agent", async () => {
    const root = pipeline("root", [
      agentStep("broken", 0, { agentId: null, agentVersion: null }),
    ]);

    const result = await resolvePipelineComposition({
      root,
      loadPipeline: loaderFor([]),
    });

    expect(result.errors[0]).toEqual({
      pipelineStepId: "broken",
      message: 'Step 1 of pipeline "Pipeline root" has no agent',
    });
  });
});
