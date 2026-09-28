import { Prisma } from "@mediapulse/database";
import { z } from "zod";

const agentFilterSchema = z.enum(["data-collection", "page-collection"]);
const statusFilterSchema = z.enum(["collected", "dropped", "failed"]);
const gateStatusFilterSchema = z.enum(["passed", "failed"]);

const COLLECTION_AGENT_BY_AGENT_FILTER = {
  "data-collection": "data_collection",
  "page-collection": "page_collection",
} as const satisfies Record<
  z.infer<typeof agentFilterSchema>,
  Prisma.CollectionUrlOutcomeWhereInput["agent"]
>;

const MATCH_NO_OUTCOMES = {
  id: { in: [] },
} satisfies Prisma.CollectionUrlOutcomeWhereInput;

export type ProcessedUrlListFilters = {
  scheduleExecutionId?: string;
  subjectId?: string;
  agent?: string;
  status?: z.infer<typeof statusFilterSchema>;
  curatedSourceId?: string;
  gateStatus?: z.infer<typeof gateStatusFilterSchema>;
};

export const buildProcessedUrlGateStatusWhere = (
  gateStatus: z.infer<typeof gateStatusFilterSchema>,
): Prisma.CollectionUrlOutcomeWhereInput => {
  if (gateStatus === "passed") {
    return { status: "collected" };
  }

  return { status: { in: ["dropped", "failed"] } };
};

export const buildProcessedUrlAgentWhere = (
  agent: string,
): Prisma.CollectionUrlOutcomeWhereInput => {
  const agentFilter = agentFilterSchema.safeParse(agent);
  if (!agentFilter.success) {
    return MATCH_NO_OUTCOMES;
  }

  return { agent: COLLECTION_AGENT_BY_AGENT_FILTER[agentFilter.data] };
};

export const buildProcessedUrlListWhere = (
  filters: ProcessedUrlListFilters,
): Prisma.CollectionUrlOutcomeWhereInput => {
  const parts: Prisma.CollectionUrlOutcomeWhereInput[] = [];

  if (filters.scheduleExecutionId) {
    parts.push({ scheduleExecutionId: filters.scheduleExecutionId });
  }

  if (filters.subjectId) {
    parts.push({ tickerId: filters.subjectId });
  }

  if (filters.agent) {
    parts.push(buildProcessedUrlAgentWhere(filters.agent));
  }

  if (filters.status) {
    parts.push({ status: filters.status });
  }

  if (filters.curatedSourceId) {
    parts.push({ curatedSourceId: filters.curatedSourceId });
  }

  if (filters.gateStatus) {
    parts.push(buildProcessedUrlGateStatusWhere(filters.gateStatus));
  }

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0] ?? {};
  return { AND: parts };
};

export { gateStatusFilterSchema, statusFilterSchema };
