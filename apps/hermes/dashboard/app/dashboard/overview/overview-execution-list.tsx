import Link from "next/link";
import {
  CalendarClock,
  MousePointerClick,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import type {
  OverviewExecution,
  OverviewExecutionKind,
} from "@/lib/dashboard-overview";

import { OVERVIEW_ROW_CLASS_NAME } from "./overview-row";

const EXECUTION_SOURCE_ICON: Record<OverviewExecutionKind, LucideIcon> = {
  schedule: CalendarClock,
  httpTrigger: Webhook,
  manual: MousePointerClick,
};

const EXECUTION_SOURCE_LABEL: Record<OverviewExecutionKind, string> = {
  schedule: "Schedule",
  httpTrigger: "HTTP trigger",
  manual: "Manual run",
};

const describeExecutionSource = (execution: OverviewExecution): string => {
  const kindLabel = EXECUTION_SOURCE_LABEL[execution.kind];
  if (execution.kind === "manual") {
    return kindLabel;
  }

  return `${kindLabel}: ${execution.parentName}`;
};

const ExecutionSource = ({ execution }: { execution: OverviewExecution }) => {
  const SourceIcon = EXECUTION_SOURCE_ICON[execution.kind];
  const sourceDescription = describeExecutionSource(execution);
  const visibleSourceName =
    execution.kind === "manual"
      ? EXECUTION_SOURCE_LABEL.manual
      : execution.parentName;

  return (
    <span
      className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
      title={sourceDescription}
    >
      <SourceIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">{sourceDescription}</span>
      <span aria-hidden className="truncate">
        {visibleSourceName}
      </span>
    </span>
  );
};

const OverviewExecutionItem = ({
  execution,
}: {
  execution: OverviewExecution;
}) => {
  return (
    <li>
      <Link href={execution.href} className={OVERVIEW_ROW_CLASS_NAME}>
        <StatusBadge status={execution.runStatus} className="min-w-24" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{execution.pipelineName}</span>
          <ExecutionSource execution={execution} />
        </span>
        <DateTime
          value={execution.executionTime}
          variant="both"
          className="shrink-0 text-xs text-muted-foreground"
        />
      </Link>
    </li>
  );
};

export const OverviewExecutionList = ({
  executions,
}: {
  executions: OverviewExecution[];
}) => {
  return (
    <ul className="flex flex-col">
      {executions.map((execution) => (
        <OverviewExecutionItem
          key={`${execution.kind}:${execution.executionId}`}
          execution={execution}
        />
      ))}
    </ul>
  );
};
