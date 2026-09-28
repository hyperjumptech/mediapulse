import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SectionSkeleton } from "@/components/page-skeletons";
import {
  parseListPagination,
  type ListPageSearchParams,
} from "@/lib/list-page-params";
import { getPipelineOptionsWithValidation } from "@/lib/pipeline-options";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { getScheduleById, getScheduleExecutionsPage } from "@/lib/schedules";

import { ScheduleDetailContent } from "./schedule-detail-content";
import { ScheduleExecutionsSection } from "./schedule-executions-section";

type ScheduleDetailSearchParams = Pick<ListPageSearchParams, "page" | "size">;

const ScheduleDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams:
    | Promise<ScheduleDetailSearchParams>
    | ScheduleDetailSearchParams;
}) => {
  const { id } = await params;
  const resolved = await Promise.resolve(searchParams);
  const { page, pageSize } = parseListPagination(resolved);
  const executionsPage = getScheduleExecutionsPage(id, page, pageSize);
  void executionsPage.catch(() => undefined);
  const [schedule, { pipelines, pipelineValidationById }] =
    await withDashboardAdmin(
      Promise.all([getScheduleById(id), getPipelineOptionsWithValidation()]),
    );

  if (!schedule) {
    notFound();
  }

  return (
    <ScheduleDetailContent
      schedule={schedule}
      executionsSection={
        <Suspense key={`${page}:${pageSize}`} fallback={<SectionSkeleton />}>
          <ScheduleExecutionsSection
            scheduleId={schedule.id}
            page={page}
            pageSize={pageSize}
            executionsPage={executionsPage}
          />
        </Suspense>
      }
      pipelines={pipelines}
      pipelineValidationById={pipelineValidationById}
    />
  );
};

export default ScheduleDetailPage;
