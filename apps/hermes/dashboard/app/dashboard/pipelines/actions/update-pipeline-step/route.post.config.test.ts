/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createUpdatePipelineStepHandler } from "./route.post.config";

const request = (body: Record<string, unknown>) =>
  ({
    body,
    params: {},
    headers: new Headers(),
    searchParams: {},
    user: { id: "user-1", name: "A", email: "a@b.com" },
  }) as never;

const includeStep = {
  id: "step-1",
  order: 0,
  kind: "pipeline",
  agentId: null,
  agentVersion: null,
  targetPipelineId: "p-child",
  input: {},
  config: {},
  agentConfigId: null,
  agentConfig: null,
  agentContractId: null,
  agentContract: null,
};

const pipelines: Record<string, unknown> = {
  "p-root": {
    id: "p-root",
    name: "Root",
    timeout: null,
    domainIntegrationId: "di-1",
    steps: [includeStep],
  },
  "p-child": {
    id: "p-child",
    name: "Child",
    timeout: null,
    domainIntegrationId: "di-1",
    steps: [],
  },
  "p-loop": {
    id: "p-loop",
    name: "Loop",
    timeout: null,
    domainIntegrationId: "di-1",
    steps: [{ ...includeStep, id: "loop-step", targetPipelineId: "p-root" }],
  },
};

const buildDb = (stepKind: string | null = "pipeline") => ({
  pipeline: {
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        pipelines[where.id] ?? null,
    ),
  },
  pipelineStep: {
    findFirst: vi
      .fn()
      .mockResolvedValue(stepKind === null ? null : { kind: stepKind }),
    update: vi.fn().mockResolvedValue({}),
  },
});

describe("createUpdatePipelineStepHandler", () => {
  it("saves the target and overrides", async () => {
    const db = buildDb();
    const handler = createUpdatePipelineStepHandler({ db: db as never });

    const result = await handler(
      request({
        pipelineId: "p-root",
        stepId: "step-1",
        targetPipelineId: "p-child",
        input: { itemId: "{{params.itemId}}" },
      }),
    );

    expect(result).toMatchObject({ status: true, data: { ok: true } });
    expect(db.pipelineStep.update).toHaveBeenCalledWith({
      where: { id: "step-1" },
      data: {
        targetPipelineId: "p-child",
        input: { itemId: "{{params.itemId}}" },
      },
    });
  });

  it("refuses a target that would create a cycle", async () => {
    const db = buildDb();
    const handler = createUpdatePipelineStepHandler({ db: db as never });

    const result = await handler(
      request({
        pipelineId: "p-root",
        stepId: "step-1",
        targetPipelineId: "p-loop",
        input: {},
      }),
    );

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "Root › Loop › Root",
    );
    expect(db.pipelineStep.update).not.toHaveBeenCalled();
  });

  it("refuses to edit an agent step", async () => {
    const db = buildDb("agent");
    const handler = createUpdatePipelineStepHandler({ db: db as never });

    const result = await handler(
      request({
        pipelineId: "p-root",
        stepId: "step-1",
        targetPipelineId: "p-child",
        input: {},
      }),
    );

    expect(result.status).toBe(false);
    expect(db.pipelineStep.update).not.toHaveBeenCalled();
  });

  it("returns an error for a step outside the pipeline", async () => {
    const db = buildDb(null);
    const handler = createUpdatePipelineStepHandler({ db: db as never });

    const result = await handler(
      request({
        pipelineId: "p-root",
        stepId: "missing",
        targetPipelineId: "p-child",
        input: {},
      }),
    );

    expect((result as { message?: string }).message).toBe("Step not found");
  });
});
