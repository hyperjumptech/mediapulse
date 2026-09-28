import { notFound } from "next/navigation";

import {
  buildExecutionDetailViewModel,
  ExecutionDetailView,
} from "@/components/execution-detail";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { getScheduleExecutionSummary } from "@/lib/schedules";

type PageProps = {
  params: Promise<{ id: string; executionId: string }>;
};

export default async function ScheduleExecutionDetailPage({
  params,
}: PageProps) {
  const { id: scheduleId, executionId } = await params;
  const summary = await withDashboardAdmin(
    getScheduleExecutionSummary(scheduleId, executionId),
  );
  if (!summary) {
    notFound();
  }

  const viewModel = buildExecutionDetailViewModel({
    parent: { kind: "schedule", id: scheduleId, name: summary.schedule.name },
    executionId,
    summary,
  });

  return <ExecutionDetailView viewModel={viewModel} />;
}
