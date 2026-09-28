import { notFound } from "next/navigation";

import {
  buildExecutionDetailViewModel,
  ExecutionDetailView,
} from "@/components/execution-detail";
import { getHttpTriggerExecutionSummary } from "@/lib/http-triggers";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

type PageProps = {
  params: Promise<{ id: string; executionId: string }>;
};

export default async function HttpTriggerExecutionDetailPage({
  params,
}: PageProps) {
  const { id: triggerId, executionId } = await params;
  const summary = await withDashboardAdmin(
    getHttpTriggerExecutionSummary(triggerId, executionId),
  );
  if (!summary) {
    notFound();
  }

  const viewModel = buildExecutionDetailViewModel({
    parent: { kind: "httpTrigger", id: triggerId, name: summary.trigger.name },
    executionId,
    summary,
  });

  return <ExecutionDetailView viewModel={viewModel} />;
}
