import { Prisma } from "@mediapulse/database";
import { z } from "zod";

const agentFilterSchema = z.enum(["data-collection", "page-collection"]);
const statusFilterSchema = z.enum(["collected", "dropped", "failed"]);
const gateStatusFilterSchema = z.enum(["passed", "failed"]);

/**
 * Parsed query filters for the processed-URLs list endpoint.
 */
export type ProcessedUrlListFilters = {
  scheduleExecutionId?: string;
  tickerId?: string;
  agent?: z.infer<typeof agentFilterSchema>;
  status?: z.infer<typeof statusFilterSchema>;
  curatedSourceId?: string;
  gateStatus?: z.infer<typeof gateStatusFilterSchema>;
};

/**
 * Maps a gate-status filter to collection URL outcome statuses.
 *
 * @param gateStatus - Passed maps to collected; failed maps to dropped or failed.
 * @returns Prisma status filter fragment.
 */
export const buildProcessedUrlGateStatusWhere = (
  gateStatus: z.infer<typeof gateStatusFilterSchema>,
): Prisma.CollectionUrlOutcomeWhereInput => {
  if (gateStatus === "passed") {
    return { status: "collected" };
  }
  return { status: { in: ["dropped", "failed"] } };
};

/**
 * Builds a Prisma `where` for processed-URL list queries from parsed filters.
 *
 * @param filters - Parsed filter values from the request.
 * @returns A `Prisma.CollectionUrlOutcomeWhereInput` (always returned, possibly empty).
 */
export const buildProcessedUrlListWhere = (
  filters: ProcessedUrlListFilters,
): Prisma.CollectionUrlOutcomeWhereInput => {
  const parts: Prisma.CollectionUrlOutcomeWhereInput[] = [];

  if (filters.scheduleExecutionId) {
    parts.push({ scheduleExecutionId: filters.scheduleExecutionId });
  }

  if (filters.tickerId) {
    parts.push({ tickerId: filters.tickerId });
  }

  if (filters.agent) {
    parts.push({
      agent:
        filters.agent === "data-collection"
          ? "data_collection"
          : "page_collection",
    });
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

export { agentFilterSchema, gateStatusFilterSchema, statusFilterSchema };
