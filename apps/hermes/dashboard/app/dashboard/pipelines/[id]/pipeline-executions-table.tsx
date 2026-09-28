"use client";

import Link from "next/link";
import {
  CalendarClock,
  MousePointerClick,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DataTableCard } from "@/components/data-table/data-table-card";
import {
  ExecutionInvocationCounts,
  ExecutionJobCounts,
  ExecutionTimeLink,
  ExecutionsEmptyState,
  ViewExecutionLink,
} from "@/components/execution-history-cells";
import { StatusBadge } from "@/components/status-badge";
import type {
  PipelineExecutionRow,
  PipelineExecutionSource,
} from "@/lib/pipeline-executions";

type PipelineExecutionsTableProps = {
  pipelineId: string;
  executions: PipelineExecutionRow[];
};

const SOURCE_PRESENTATION: Record<
  PipelineExecutionSource,
  { label: string; icon: LucideIcon }
> = {
  schedule: { label: "Schedule", icon: CalendarClock },
  "http-trigger": { label: "Trigger", icon: Webhook },
  manual: { label: "Manual", icon: MousePointerClick },
};

const executionDetailHref = (
  pipelineId: string,
  execution: PipelineExecutionRow,
): string => {
  if (execution.source === "schedule") {
    return `/dashboard/schedules/${execution.sourceId}/executions/${execution.id}`;
  }
  if (execution.source === "http-trigger") {
    return `/dashboard/http-triggers/${execution.sourceId}/executions/${execution.id}`;
  }

  return `/dashboard/pipelines/${pipelineId}/executions/${execution.id}`;
};

const executionSourceHref = (execution: PipelineExecutionRow) => {
  if (execution.source === "schedule") {
    return `/dashboard/schedules/${execution.sourceId}`;
  }
  if (execution.source === "http-trigger") {
    return `/dashboard/http-triggers/${execution.sourceId}`;
  }

  return null;
};

const ExecutionSource = ({
  execution,
}: {
  execution: PipelineExecutionRow;
}) => {
  const { label, icon: SourceIcon } = SOURCE_PRESENTATION[execution.source];
  const sourceHref = executionSourceHref(execution);
  const sourceLink =
    sourceHref !== null && execution.sourceName !== null
      ? { href: sourceHref, name: execution.sourceName }
      : null;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        <SourceIcon aria-hidden />
        {label}
      </Badge>
      {sourceLink ? (
        <Link
          href={sourceLink.href}
          className="max-w-48 truncate text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {sourceLink.name}
        </Link>
      ) : null}
    </span>
  );
};

export const PipelineExecutionsTable = ({
  pipelineId,
  executions,
}: PipelineExecutionsTableProps) => {
  if (executions.length === 0) {
    return (
      <DataTableCard>
        <ExecutionsEmptyState description="Runs from this pipeline's schedules, HTTP triggers and manual runs show up here." />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Started</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Run</TableHead>
            <TableHead className="hidden sm:table-cell">Enqueue</TableHead>
            <TableHead className="hidden text-right md:table-cell">
              Jobs
            </TableHead>
            <TableHead className="text-right">Invocations</TableHead>
            <TableHead className="hidden text-right md:table-cell">
              Elapsed
            </TableHead>
            <TableHead className="pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map((execution) => {
            const detailHref = executionDetailHref(pipelineId, execution);

            return (
              <TableRow key={`${execution.source}:${execution.id}`}>
                <TableCell className="pl-4">
                  <ExecutionTimeLink
                    href={detailHref}
                    executionTime={execution.executionTime}
                  />
                </TableCell>
                <TableCell>
                  <ExecutionSource execution={execution} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={execution.runStatus} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge status={execution.enqueueStatus} />
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  <ExecutionJobCounts
                    jobsCreated={execution.jobsCreated}
                    jobsEnqueued={execution.jobsEnqueued}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <ExecutionInvocationCounts
                    succeededInvocationCount={
                      execution.succeededInvocationCount
                    }
                    failedInvocationCount={execution.failedInvocationCount}
                  />
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                  {execution.elapsedLabel}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <ViewExecutionLink href={detailHref} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
