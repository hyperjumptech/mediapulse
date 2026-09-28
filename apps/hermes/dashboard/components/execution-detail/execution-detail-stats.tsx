import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

import { Card } from "@workspace/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";

import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";

import type { ExecutionDetailViewModel } from "./execution-detail-view-model";

const STAT_VALUE_CLASS_NAME =
  "text-lg leading-tight font-semibold tracking-tight tabular-nums";

const ExecutionStatCard = ({
  label,
  labelAddon,
  children,
}: {
  label: string;
  labelAddon?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <Card className="min-w-0 gap-1.5 px-4 py-3 shadow-none">
      <dt className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {labelAddon}
      </dt>
      <dd className="flex min-w-0 flex-col items-start gap-0.5">{children}</dd>
    </Card>
  );
};

const StatCaption = ({ children }: { children: ReactNode }) => {
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {children}
    </span>
  );
};

const InvocationCountsStat = ({
  succeededInvocationCount,
  failedInvocationCount,
}: {
  succeededInvocationCount: number;
  failedInvocationCount: number;
}) => {
  const hasFailures = failedInvocationCount > 0;
  const failedClassName = hasFailures
    ? "text-destructive dark:text-red-400"
    : "text-muted-foreground";

  return (
    <>
      <span className={STAT_VALUE_CLASS_NAME}>
        {succeededInvocationCount}
        <span className="text-muted-foreground"> / </span>
        <span data-failed={hasFailures} className={failedClassName}>
          {failedInvocationCount}
        </span>
      </span>
      <StatCaption>ok / failed</StatCaption>
    </>
  );
};

const TransportDetailTooltip = ({ detail }: { detail: string }) => {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label="About invocation transport"
        className="shrink-0 cursor-help rounded-full text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <CircleHelp aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
};

export const ExecutionDetailStats = ({
  viewModel,
}: {
  viewModel: ExecutionDetailViewModel;
}) => {
  const {
    runStatus,
    enqueueStatus,
    executionTimeIso,
    elapsedLabel,
    jobsCreated,
    jobsEnqueued,
    succeededInvocationCount,
    failedInvocationCount,
    transport,
  } = viewModel;
  const transportTooltip = <TransportDetailTooltip detail={transport.detail} />;

  return (
    <dl
      data-slot="execution-summary"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
    >
      <ExecutionStatCard label="Run status">
        <StatusBadge status={runStatus} />
      </ExecutionStatCard>
      <ExecutionStatCard label="Enqueue status">
        <StatusBadge status={enqueueStatus} />
      </ExecutionStatCard>
      <ExecutionStatCard label="Started">
        <DateTime
          value={executionTimeIso}
          style="datetime"
          className={cn(STAT_VALUE_CLASS_NAME, "text-foreground")}
        />
        <StatCaption>Elapsed {elapsedLabel}</StatCaption>
      </ExecutionStatCard>
      <ExecutionStatCard label="Jobs">
        <span className={STAT_VALUE_CLASS_NAME}>
          {jobsCreated}
          <span className="text-muted-foreground"> / </span>
          {jobsEnqueued}
        </span>
        <StatCaption>created / enqueued</StatCaption>
      </ExecutionStatCard>
      <ExecutionStatCard label="Invocations">
        <InvocationCountsStat
          succeededInvocationCount={succeededInvocationCount}
          failedInvocationCount={failedInvocationCount}
        />
      </ExecutionStatCard>
      <ExecutionStatCard
        label="Invocation transport"
        labelAddon={transportTooltip}
      >
        <span className="text-sm leading-snug font-medium text-foreground">
          {transport.headline}
        </span>
      </ExecutionStatCard>
    </dl>
  );
};
