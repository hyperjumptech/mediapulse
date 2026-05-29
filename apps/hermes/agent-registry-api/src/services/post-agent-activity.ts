import { type Prisma, prisma } from "@hermes/orchestration-database";

/** Body shape accepted by POST /agent-activity. */
export type PostAgentActivityInput = {
  jobId: string;
  title: string;
  description?: string;
  status: "processing" | "completed";
};

type AgentActivityDelegate = Pick<
  Prisma.TransactionClient["agentActivity"],
  "updateMany" | "create"
>;

type PostAgentActivityDb = Pick<typeof prisma, "$transaction">;

/**
 * Marks prior in-progress rows completed and inserts the new activity row.
 *
 * @param input - Validated POST body fields.
 * @param agentActivity - Prisma delegate (transaction-scoped in production).
 * @returns The created row id.
 */
export const postAgentActivityWithinTransaction = async (
  input: PostAgentActivityInput,
  agentActivity: AgentActivityDelegate,
): Promise<{ id: string }> => {
  await agentActivity.updateMany({
    where: { jobId: input.jobId, status: "processing" },
    data: { status: "completed" },
  });

  const row = await agentActivity.create({
    data: {
      jobId: input.jobId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
    },
    select: { id: true },
  });

  return { id: row.id };
};

/**
 * Records agent activity for a Hermes job inside a single DB transaction.
 *
 * @param input - Validated POST body fields.
 * @param db - Prisma client (injectable for tests).
 * @returns The created row id.
 */
export const postAgentActivity = async (
  input: PostAgentActivityInput,
  db: PostAgentActivityDb = prisma,
): Promise<{ id: string }> =>
  db.$transaction((tx) =>
    postAgentActivityWithinTransaction(input, tx.agentActivity),
  );
