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

const ExecutionSourceDescription = ({
  sourceLabel,
  pipeline,
}: {
  sourceLabel: string;
  pipeline: ExecutionDetailPipeline | null;
}) => {
  if (!pipeline) {
    return <>{sourceLabel}</>;
  }

  const pipelineHref = `/dashboard/pipelines/${pipeline.id}`;

  return (
    <>
      {sourceLabel}
      {" · "}
      <Link
        href={pipelineHref}
        className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
      >
        <GitBranch aria-hidden className="size-3.5 shrink-0" />
        {pipeline.name}
      </Link>
    </>
  );
};

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

const ExecutionMetadataHints = ({ hints }: { hints: string[] }) => {
  if (hints.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {hints.map((hint) => (
        <li key={hint}>{hint}</li>
      ))}
    </ul>
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
    <div className="flex flex-col gap-2">
      <PageHeader
        title="Execution"
        badges={<StatusBadge status={runStatus} />}
        description={
          <ExecutionSourceDescription
            sourceLabel={sourceLabel}
            pipeline={pipeline}
          />
        }
        actions={actions}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <CopyableId value={executionId} label="Copy execution ID" />
        <ExecutionMetadataHints hints={metadataHints} />
      </div>
    </div>
  );
};
