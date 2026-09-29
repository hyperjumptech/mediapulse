import { describe, expect, it, vi } from "vitest";

import {
  checkPipelineStepsComposition,
  includedPipelineStepLabels,
} from "./check-pipeline-steps-composition";

const agentStep = (id: string, order: number, agentId: string) => ({
  id,
  order,
  kind: "agent" as const,
  agentId,
  agentVersion: "1.0.0",
  targetPipelineId: null,
  input: {},
  config: {},
  agentConfigId: null,
  agentConfig: null,
  agentContractId: null,
  agentContract: null,
});

const pipelineStep = (id: string, order: number, targetPipelineId: string) => ({
  ...agentStep(id, order, "unused"),
  kind: "pipeline" as const,
  agentId: null,
  agentVersion: null,
  targetPipelineId,
});

const pipelines: Record<string, unknown> = {
  root: {
    id: "root",
    name: "Root",
    timeout: null,
    domainIntegrationId: "di-1",
    steps: [agentStep("root-agent", 0, "prepare")],
  },
  child: {
    id: "child",
    name: "Child",
    timeout: null,
    domainIntegrationId: "di-1",
    steps: [
      agentStep("child-a", 0, "collect"),
      agentStep("child-b", 1, "send"),
    ],
  },
  loop: {
    id: "loop",
    name: "Loop",
    timeout: null,
    domainIntegrationId: "di-1",
    steps: [pipelineStep("loop-back", 0, "root")],
  },
};

const buildDb = () => ({
  pipeline: {
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        pipelines[where.id] ?? null,
    ),
  },
});

describe("checkPipelineStepsComposition", () => {
  it("accepts a proposed step that includes another pipeline", async () => {
    const result = await checkPipelineStepsComposition({
      db: buildDb() as never,
      pipelineId: "root",
      proposeSteps: (steps) => [...steps, pipelineStep("new", 1, "child")],
    });

    expect(result).toEqual({ valid: true });
  });

  it("refuses a proposed step that creates a cycle", async () => {
    const result = await checkPipelineStepsComposition({
      db: buildDb() as never,
      pipelineId: "root",
      proposeSteps: (steps) => [...steps, pipelineStep("new", 1, "loop")],
    });

    expect(result).toEqual({
      valid: false,
      message: expect.stringContaining("Root › Loop › Root"),
    });
  });

  it("reports a missing pipeline", async () => {
    const result = await checkPipelineStepsComposition({
      db: buildDb() as never,
      pipelineId: "missing",
      proposeSteps: (steps) => steps,
    });

    expect(result).toEqual({ valid: false, message: "Pipeline not found" });
  });
});

describe("includedPipelineStepLabels", () => {
  it("lists the inlined agent steps under the pipeline step that includes them", async () => {
    const db = buildDb();
    pipelines.parent = {
      id: "parent",
      name: "Parent",
      timeout: null,
      domainIntegrationId: "di-1",
      steps: [
        agentStep("parent-agent", 0, "prepare"),
        pipelineStep("include-child", 1, "child"),
      ],
    };

    const labels = await includedPipelineStepLabels({
      db: db as never,
      pipelineId: "parent",
    });

    expect(labels).toEqual({
      "include-child": ["Child › collect@1.0.0", "Child › send@1.0.0"],
    });
  });
});
