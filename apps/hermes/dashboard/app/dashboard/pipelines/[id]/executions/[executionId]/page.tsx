import { notFound } from "next/navigation";

import {
  buildExecutionDetailViewModel,
  ExecutionDetailView,
} from "@/components/execution-detail";
import { getManualPipelineExecutionSummary } from "@/lib/pipeline-executions";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

type PageProps = {
  params: Promise<{ id: string; executionId: string }>;
};

export default async function PipelineExecutionDetailPage({
  params,
}: PageProps) {
  const { id: pipelineId, executionId } = await params;
  const summary = await withDashboardAdmin(
    getManualPipelineExecutionSummary(pipelineId, executionId),
  );
  if (!summary) {
    notFound();
  }

  const viewModel = buildExecutionDetailViewModel({
    parent: { kind: "manual", id: pipelineId, name: summary.pipeline.name },
    executionId,
    summary,
  });

  return <ExecutionDetailView viewModel={viewModel} />;
}
