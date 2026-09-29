/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createAddPipelineStepHandler } from "./route.post.config";

const request = (body: { pipelineId: string; targetPipelineId: string }) =>
  ({
    body,
    params: {},
    headers: new Headers(),
    searchParams: {},
    user: { id: "user-1", name: "A", email: "a@b.com" },
  }) as never;

const pipelineRow = (id: string, steps: unknown[]) => ({
  id,
  name: id,
  timeout: null,
  domainIntegrationId: "di-1",
  steps,
});

const buildDb = (pipelines: Record<string, unknown>) => ({
  pipeline: {
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        pipelines[where.id] ?? null,
    ),
  },
  pipelineStep: {
    aggregate: vi.fn().mockResolvedValue({ _max: { order: 1 } }),
    create: vi.fn().mockResolvedValue({ id: "new-step" }),
  },
});

describe("createAddPipelineStepHandler", () => {
  it("appends a pipeline step pointing at the target", async () => {
    const db = buildDb({
      "p-root": pipelineRow("p-root", []),
      "p-child": pipelineRow("p-child", []),
    });
    const handler = createAddPipelineStepHandler({ db: db as never });

    const result = await handler(
      request({ pipelineId: "p-root", targetPipelineId: "p-child" }),
    );

    expect(result).toMatchObject({
      status: true,
      data: { stepId: "new-step" },
    });
    expect(db.pipelineStep.create).toHaveBeenCalledWith({
      data: {
        pipelineId: "p-root",
        order: 2,
        kind: "pipeline",
        targetPipelineId: "p-child",
        input: {},
        config: {},
        createdById: "user-1",
      },
      select: { id: true },
    });
  });

  it("refuses a pipeline that would include itself", async () => {
    const db = buildDb({ "p-root": pipelineRow("p-root", []) });
    const handler = createAddPipelineStepHandler({ db: db as never });

    const result = await handler(
      request({ pipelineId: "p-root", targetPipelineId: "p-root" }),
    );

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain("cycle");
    expect(db.pipelineStep.create).not.toHaveBeenCalled();
  });

  it("refuses a target from another domain integration", async () => {
    const db = buildDb({
      "p-root": pipelineRow("p-root", []),
      "p-other": { ...pipelineRow("p-other", []), domainIntegrationId: "di-2" },
    });
    const handler = createAddPipelineStepHandler({ db: db as never });

    const result = await handler(
      request({ pipelineId: "p-root", targetPipelineId: "p-other" }),
    );

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "different domain integration",
    );
  });
});
