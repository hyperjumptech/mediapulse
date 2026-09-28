import Link from "next/link";
import { Plus, Workflow } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DataTableCard } from "@/components/data-table/data-table-card";
import { formatCreatedBy } from "@/lib/format-created-by";
import {
  getPipelineStatus,
  type PipelineValidationResult,
} from "@/lib/pipeline-status";
import type { PipelineSummary } from "@/lib/pipeline-summaries";

import { PipelineRowActions } from "./pipeline-row-actions";
import { PipelineStatusBadge } from "./pipeline-status-badge";

type EditPipelineHandler = (pipelineId: string) => void;

type CreatePipelineHandler = () => void;

const MISSING_VALIDATION: PipelineValidationResult = {
  valid: false,
  warnings: [],
};

const PipelinesEmptyState = ({
  onCreate,
}: {
  onCreate?: CreatePipelineHandler;
}) => {
  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Workflow aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No pipelines yet</EmptyTitle>
        <EmptyDescription>
          A pipeline chains agent steps together. Run it by hand, on a schedule,
          or from an HTTP trigger.
        </EmptyDescription>
      </EmptyHeader>
      {onCreate ? (
        <EmptyContent>
          <Button type="button" size="sm" onClick={onCreate}>
            <Plus aria-hidden />
            New pipeline
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
};

export const PipelinesTable = ({
  pipelines,
  pipelineValidationById = {},
  onEdit,
  onCreate,
}: {
  pipelines: PipelineSummary[];
  pipelineValidationById?: Record<string, PipelineValidationResult>;
  onEdit?: EditPipelineHandler;
  onCreate?: CreatePipelineHandler;
}) => {
  if (pipelines.length === 0) {
    return (
      <DataTableCard>
        <PipelinesEmptyState onCreate={onCreate} />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Name</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Created by</TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pipelines.map((pipeline) => {
            const validation =
              pipelineValidationById[pipeline.id] ?? MISSING_VALIDATION;
            const status = getPipelineStatus(pipeline, validation);
            const description = pipeline.description?.trim() || "—";
            const createdBy = formatCreatedBy(
              pipeline.createdBy,
              pipeline.createdById,
            );

            return (
              <TableRow key={pipeline.id}>
                <TableCell className="pl-4">
                  <Link
                    href={`/dashboard/pipelines/${pipeline.id}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {pipeline.name}
                  </Link>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  <div
                    className="max-w-md truncate"
                    title={pipeline.description ?? undefined}
                  >
                    {description}
                  </div>
                </TableCell>
                <TableCell>
                  <PipelineStatusBadge
                    status={status}
                    warnings={validation.warnings}
                  />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {createdBy}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <PipelineRowActions
                    pipelineId={pipeline.id}
                    pipelineName={pipeline.name}
                    onEdit={onEdit}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
