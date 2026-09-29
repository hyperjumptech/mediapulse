import { describe, expect, it, vi } from "vitest";

import { getPipelineRunParamKeys } from "./pipeline-run-param-keys";

const agentStep = (
  id: string,
  input: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  order: 0,
  kind: "agent",
  agentId: `agent-${id}`,
  agentVersion: "1.0.0",
  targetPipelineId: null,
  input,
  config: {},
  agentConfigId: null,
  agentConfig: null,
  agentContractId: null,
  agentContract: null,
  ...overrides,
});

const buildDb = (pipelines: Record<string, unknown>) => ({
  pipeline: {
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        pipelines[where.id] ?? null,
    ),
  },
});

describe("getPipelineRunParamKeys", () => {
  it("collects run parameters from inlined steps, overrides and saved configs", async () => {
    const db = buildDb({
      root: {
        id: "root",
        name: "Root",
        timeout: null,
        domainIntegrationId: "di-1",
        steps: [
          agentStep("first", { mode: "{{params.mode}}" }),
          {
            ...agentStep("include", { itemId: "{{params.itemId}}" }),
            order: 1,
            kind: "pipeline",
            agentId: null,
            agentVersion: null,
            targetPipelineId: "child",
          },
        ],
      },
      child: {
        id: "child",
        name: "Child",
        timeout: null,
        domainIntegrationId: "di-1",
        steps: [
          agentStep(
            "child-step",
            { itemId: "db:item:id" },
            { agentConfig: { config: { region: "{{params.region}}" } } },
          ),
        ],
      },
    });

    const keys = await getPipelineRunParamKeys("root", db as never);

    expect(keys).toEqual(["itemId", "mode", "region"]);
  });

  it("returns no keys for a pipeline without run parameters", async () => {
    const db = buildDb({
      root: {
        id: "root",
        name: "Root",
        timeout: null,
        domainIntegrationId: "di-1",
        steps: [agentStep("only", { itemId: "{{ITEM_ID}}" })],
      },
    });

    expect(await getPipelineRunParamKeys("root", db as never)).toEqual([]);
  });

  it("returns no keys for a missing pipeline", async () => {
    const db = buildDb({});

    expect(await getPipelineRunParamKeys("missing", db as never)).toEqual([]);
  });
});
