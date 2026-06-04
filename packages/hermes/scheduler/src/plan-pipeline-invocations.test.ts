/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { planPipelineInvocations } from "./plan-pipeline-invocations.js";

const agentRegistry = [
  {
    agentId: "agent-a",
    agentVersion: "1.0.0",
    endpoint: { url: "https://agent.example/run", method: "POST" },
    isActive: true,
    inputSchema: null,
    configSchema: null,
  },
];

const createDb = () => ({
  variable: { findMany: vi.fn().mockResolvedValue([]) },
  agentRegistry: { findMany: vi.fn().mockResolvedValue(agentRegistry) },
});

const basePipeline = {
  id: "p1",
  domainIntegrationId: "di-1",
};

const baseStep = {
  id: "step-1",
  agentId: "agent-a",
  agentVersion: "1.0.0",
  input: { tickerId: "t1" },
  config: {},
  agentConfigId: null,
  agentConfig: null,
  agentContractId: null,
  agentContract: null,
};

const expandStepInputs = async (ctx: { input: Record<string, unknown> }) => [
  ctx.input,
];

describe("planPipelineInvocations — contract injection", () => {
  it("omits contract from PlannedInvocation when step has no agentContractId", async () => {
    const db = createDb();
    const result = await planPipelineInvocations({
      db: db as never,
      pipeline: { ...basePipeline, steps: [baseStep] },
      sourceId: "src-1",
      expandStepInputs,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.waveList).toHaveLength(1);
    const job = result.waveList[0]![0]!;
    expect(job.contract).toBeUndefined();
  });

  it("omits contract from PlannedInvocation when agentContractId is set but agentContract is null", async () => {
    const db = createDb();
    const step = { ...baseStep, agentContractId: "cid-1", agentContract: null };
    const result = await planPipelineInvocations({
      db: db as never,
      pipeline: { ...basePipeline, steps: [step] },
      sourceId: "src-1",
      expandStepInputs,
    });

    expect(result.errors).toHaveLength(0);
    const job = result.waveList[0]![0]!;
    expect(job.contract).toBeUndefined();
  });

  it("injects contract into PlannedInvocation when step has agentContractId and agentContract", async () => {
    const db = createDb();
    const contract = { brief: "Daily industry newsletter.", version: "1.0" };
    const step = {
      ...baseStep,
      agentContractId: "cid-1",
      agentContract: contract,
    };
    const result = await planPipelineInvocations({
      db: db as never,
      pipeline: { ...basePipeline, steps: [step] },
      sourceId: "src-1",
      expandStepInputs,
    });

    expect(result.errors).toHaveLength(0);
    const job = result.waveList[0]![0]!;
    expect(job.contract).toEqual(contract);
  });

  it("produces separate PlannedInvocations per expanded input, each carrying the contract", async () => {
    const db = createDb();
    const contract = { brief: "Newsletter brief.", version: "2.0" };
    const step = {
      ...baseStep,
      agentContractId: "cid-2",
      agentContract: contract,
    };
    const expand = async (ctx: { input: Record<string, unknown> }) => [
      { ...ctx.input, ticker: "T1" },
      { ...ctx.input, ticker: "T2" },
    ];
    const result = await planPipelineInvocations({
      db: db as never,
      pipeline: { ...basePipeline, steps: [step] },
      sourceId: "src-1",
      expandStepInputs: expand,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.waveList[0]).toHaveLength(2);
    for (const job of result.waveList[0]!) {
      expect(job.contract).toEqual(contract);
    }
  });
});
