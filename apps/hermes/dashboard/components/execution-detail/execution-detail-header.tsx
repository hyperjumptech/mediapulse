import Link from "next/link";
import { GitBranch, ListChecks } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { CopyableId } from "@/components/copyable-id";
import { HermesExecutionCancelButton } from "@/components/hermes-execution-cancel-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";

import type {
  ExecutionDetailPipeline,
  ExecutionDetailViewModel,
} from "./execution-detail-view-model";

const PipelineLink = ({ pipeline }: { pipeline: ExecutionDetailPipeline }) => (
  <Link
    href={`/dashboard/pipelines/${pipeline.id}`}
    className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
  >
    <GitBranch aria-hidden className="size-3.5 shrink-0" />
    {pipeline.name}
  </Link>
);

const ExecutionDetailActions = ({
  viewModel,
}: {
  viewModel: ExecutionDetailViewModel;
}) => {
  const { canCancel, cancelTarget, runStatus, processedUrlsHref } = viewModel;

  return (
    <>
      {processedUrlsHref ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={processedUrlsHref}>
            <ListChecks aria-hidden />
            Processed URLs
          </Link>
        </Button>
      ) : null}
      {canCancel ? (
        <HermesExecutionCancelButton
          target={cancelTarget}
          runStatus={runStatus}
        />
      ) : null}
    </>
  );
};

export const ExecutionDetailHeader = ({
  viewModel,
}: {
  viewModel: ExecutionDetailViewModel;
}) => {
  const { executionId, runStatus, sourceLabel, pipeline, metadataHints } =
    viewModel;
  const hasActions = viewModel.canCancel || viewModel.processedUrlsHref != null;
  const actions = hasActions ? (
    <ExecutionDetailActions viewModel={viewModel} />
  ) : undefined;

  return (
    <PageHeader
      badges={
        <>
          <StatusBadge status={runStatus} />
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {sourceLabel ? <span>{sourceLabel}</span> : null}
            {pipeline ? <PipelineLink pipeline={pipeline} /> : null}
            {metadataHints.map((hint) => (
              <span key={hint} className="text-xs">
                {hint}
              </span>
            ))}
            <CopyableId value={executionId} label="Copy execution ID" />
          </div>
        </>
      }
      actions={actions}
    />
  );
};
