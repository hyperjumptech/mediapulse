import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import { getScheduleById, getScheduleExecutionsPage } from "@/lib/schedules";
import { getPipelinesValidationMap } from "@/lib/validate-pipeline";
import { prisma } from "@workspace/database";

import { ScheduleDetailContent } from "./schedule-detail-content";

const DEFAULT_PAGE_SIZE = 15;

/**
 * Schedule detail page. Loads schedule by id, paginated executions (newest first), and pipelines for the edit modal.
 * Renders schedule header with Edit button and executions table with error-log modal.
 */
const ScheduleDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams:
    | Promise<{ page?: string; size?: string }>
    | { page?: string; size?: string };
}) => {
  const { id } = await params;
  const resolved = await Promise.resolve(searchParams);
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(resolved.size ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );

  const [schedule, executionsResult, pipelines] = await Promise.all([
    getScheduleById(id),
    getScheduleExecutionsPage(id, page, pageSize),
    getPipelinesWithSteps(),
  ]);

  if (!schedule) {
    notFound();
  }

  const pipelineValidationById = await getPipelinesValidationMap(
    pipelines,
    prisma,
  );

  return (
    <ScheduleDetailContent
      schedule={schedule}
      executions={executionsResult.executions}
      totalExecutions={executionsResult.total}
      currentPage={executionsResult.page}
      pageSize={executionsResult.pageSize}
      pipelines={pipelines}
      pipelineValidationById={pipelineValidationById}
    />
  );
};

export default withAuthProtection(ScheduleDetailPage);
