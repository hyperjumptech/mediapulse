/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hermes/env", () => ({
  env: {
    ORCHESTRATION_DATABASE_URL:
      "postgresql://user:pass@localhost:5432/db?schema=orchestration",
  },
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import {
  postAgentActivity,
  postAgentActivityWithinTransaction,
  type PostAgentActivityInput,
} from "./post-agent-activity";

const sampleInput = {
  jobId: "70829892-e244-4df5-a3bf-f41fae0692fe",
  title: "Loaded article batch",
  description: "6 sources",
  status: "processing",
} satisfies PostAgentActivityInput;

describe("postAgentActivityWithinTransaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes open rows for the job before creating the new row", async () => {
    // Setup
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const create = vi.fn().mockResolvedValue({ id: "row-new" });

    // Act
    const result = await postAgentActivityWithinTransaction(sampleInput, {
      updateMany,
      create,
    });

    // Assert
    expect(updateMany).toHaveBeenCalledWith({
      where: { jobId: sampleInput.jobId, status: "processing" },
      data: { status: "completed" },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        jobId: sampleInput.jobId,
        title: sampleInput.title,
        description: sampleInput.description,
        status: sampleInput.status,
      },
      select: { id: true },
    });
    expect(result).toEqual({ id: "row-new" });
  });

  it("stores null description when omitted", async () => {
    // Setup
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn().mockResolvedValue({ id: "row-final" });

    // Act
    await postAgentActivityWithinTransaction(
      {
        jobId: sampleInput.jobId,
        title: "Article analysis complete",
        status: "completed",
      },
      { updateMany, create },
    );

    // Assert
    expect(create).toHaveBeenCalledWith({
      data: {
        jobId: sampleInput.jobId,
        title: "Article analysis complete",
        description: null,
        status: "completed",
      },
      select: { id: true },
    });
  });
});

describe("postAgentActivity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to the transaction-scoped helper", async () => {
    // Setup
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: "row-tx" });
    const $transaction = vi.fn(
      async (
        fn: (tx: {
          agentActivity: {
            updateMany: typeof updateMany;
            create: typeof create;
          };
        }) => Promise<{ id: string }>,
      ) => fn({ agentActivity: { updateMany, create } }),
    );

    // Act
    const result = await postAgentActivity(sampleInput, { $transaction });

    // Assert
    expect($transaction).toHaveBeenCalledOnce();
    expect(result).toEqual({ id: "row-tx" });
  });
});
