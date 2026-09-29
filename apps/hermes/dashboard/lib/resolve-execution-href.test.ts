import { describe, expect, it, vi } from "vitest";

import { resolveExecutionHref } from "./resolve-execution-href";

const buildDb = (found: {
  schedule?: { scheduleId: string } | null;
  httpTrigger?: { httpTriggerId: string } | null;
  manual?: { pipelineId: string } | null;
}) => ({
  scheduleExecution: {
    findUnique: vi.fn().mockResolvedValue(found.schedule ?? null),
  },
  httpTriggerExecution: {
    findUnique: vi.fn().mockResolvedValue(found.httpTrigger ?? null),
  },
  manualPipelineExecution: {
    findUnique: vi.fn().mockResolvedValue(found.manual ?? null),
  },
});

describe("resolveExecutionHref", () => {
  it("resolves a schedule execution to its schedule run page", async () => {
    const db = buildDb({ schedule: { scheduleId: "sched-1" } });

    const href = await resolveExecutionHref("exec-1", db as never);

    expect(href).toBe("/dashboard/schedules/sched-1/executions/exec-1");
    expect(db.scheduleExecution.findUnique).toHaveBeenCalledWith({
      where: { id: "exec-1" },
      select: { scheduleId: true },
    });
  });

  it("resolves an HTTP trigger execution to its trigger run page", async () => {
    const db = buildDb({ httpTrigger: { httpTriggerId: "trigger-1" } });

    const href = await resolveExecutionHref("exec-2", db as never);

    expect(href).toBe("/dashboard/http-triggers/trigger-1/executions/exec-2");
  });

  it("resolves a manual execution to its pipeline run page", async () => {
    const db = buildDb({ manual: { pipelineId: "pipe-1" } });

    const href = await resolveExecutionHref("exec-3", db as never);

    expect(href).toBe("/dashboard/pipelines/pipe-1/executions/exec-3");
  });

  it("returns null for an unknown execution id", async () => {
    const db = buildDb({});

    expect(await resolveExecutionHref("missing", db as never)).toBeNull();
  });
});
