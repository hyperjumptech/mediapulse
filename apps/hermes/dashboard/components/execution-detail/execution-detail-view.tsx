import { BreadcrumbEntityLabel } from "@/components/breadcrumb-entity-label";
import { EnqueueDiagnosticsPanel } from "@/components/enqueue-diagnostics";
import { JsonBlock } from "@/components/json-block";

import { ExecutionDetailHeader } from "./execution-detail-header";
import { ExecutionInvocationsTableSection } from "./execution-invocations-table-section";
import { ExecutionDetailStats } from "./execution-detail-stats";
import type { ExecutionDetailViewModel } from "./execution-detail-view-model";
import { ExecutionPipelineStepsTable } from "./execution-pipeline-steps-table";

export const ExecutionDetailView = ({
  viewModel,
}: {
  viewModel: ExecutionDetailViewModel;
}) => {
  const {
    parent,
    enqueueStatus,
    enqueueErrors,
    enqueueMetadata,
    requestSnapshotJson,
    runParamsJson,
    steps,
    invocations,
    payloadSource,
  } = viewModel;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BreadcrumbEntityLabel segment={parent.id} label={parent.name} />
      <ExecutionDetailHeader viewModel={viewModel} />
      <ExecutionDetailStats viewModel={viewModel} />
      <EnqueueDiagnosticsPanel
        enqueueStatus={enqueueStatus}
        errors={enqueueErrors}
        metadata={enqueueMetadata}
      />
      {runParamsJson != null ? (
        <JsonBlock value={runParamsJson} title="Run parameters" />
      ) : null}
      {requestSnapshotJson != null ? (
        <JsonBlock
          value={requestSnapshotJson}
          title="Request snapshot"
          maxHeight="max-h-[32rem]"
        />
      ) : null}
      <ExecutionPipelineStepsTable steps={steps} />
      <ExecutionInvocationsTableSection
        invocations={invocations}
        payloadSource={payloadSource}
      />
    </div>
  );
};
