import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

import { BreadcrumbEntityLabel } from "@/components/breadcrumb-entity-label";
import { EnqueueDiagnosticsPanel } from "@/components/enqueue-diagnostics";
import { ScheduleExecutionInvocationsTable } from "@/components/schedule-execution-invocations-table";

import { ExecutionDetailHeader } from "./execution-detail-header";
import { ExecutionDetailStats } from "./execution-detail-stats";
import type { ExecutionDetailViewModel } from "./execution-detail-view-model";
import { ExecutionPipelineStepsTable } from "./execution-pipeline-steps-table";

const countFormatter = new Intl.NumberFormat("en-US");

const ExecutionDetailSection = ({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) => {
  const formattedCount = countFormatter.format(count);

  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formattedCount}
        </span>
      </div>
      {children}
    </section>
  );
};

const RequestSnapshotCard = ({ json }: { json: string }) => {
  return (
    <Card
      role="region"
      aria-labelledby="request-snapshot-heading"
      className="min-w-0 gap-4 py-5 shadow-none"
    >
      <CardHeader className="gap-1 px-5">
        <CardTitle>
          <h2 id="request-snapshot-heading" className="text-base font-semibold">
            Request snapshot
          </h2>
        </CardTitle>
        <CardDescription>
          The request that started this execution. Values that look like
          credentials are hidden.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 px-5">
        <pre
          className="max-h-[32rem] overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          tabIndex={0}
        >
          {json}
        </pre>
      </CardContent>
    </Card>
  );
};

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
      {requestSnapshotJson != null ? (
        <RequestSnapshotCard json={requestSnapshotJson} />
      ) : null}
      <ExecutionDetailSection
        id="pipeline-steps-heading"
        title="Pipeline steps"
        count={steps.length}
      >
        <ExecutionPipelineStepsTable steps={steps} />
      </ExecutionDetailSection>
      <ExecutionDetailSection
        id="invocations-heading"
        title="Invocations"
        count={invocations.length}
      >
        <ScheduleExecutionInvocationsTable
          invocations={invocations}
          payloadSource={payloadSource}
        />
      </ExecutionDetailSection>
    </div>
  );
};
