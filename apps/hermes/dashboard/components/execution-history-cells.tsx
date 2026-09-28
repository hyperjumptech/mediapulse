import Link from "next/link";
import { ChevronRight, History } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";

import { DateTime } from "@/components/date-time/date-time";

export const ExecutionsEmptyState = ({
  description,
}: {
  description: string;
}) => {
  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <History aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No executions yet</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

export const ExecutionTimeLink = ({
  href,
  executionTime,
}: {
  href: string;
  executionTime: Date;
}) => {
  return (
    <Link
      href={href}
      className="font-medium text-foreground underline-offset-4 hover:underline"
    >
      <span className="sr-only">Open execution from</span>{" "}
      <DateTime value={executionTime} variant="both" />
    </Link>
  );
};

export const ExecutionJobCounts = ({
  jobsCreated,
  jobsEnqueued,
}: {
  jobsCreated: number;
  jobsEnqueued: number;
}) => {
  const description = `${jobsCreated} created, ${jobsEnqueued} enqueued`;

  return (
    <span className="tabular-nums" title={description}>
      {jobsCreated}
      <span className="text-muted-foreground"> / </span>
      {jobsEnqueued}
    </span>
  );
};

export const ExecutionInvocationCounts = ({
  succeededInvocationCount,
  failedInvocationCount,
}: {
  succeededInvocationCount: number;
  failedInvocationCount: number;
}) => {
  const hasFailures = failedInvocationCount > 0;
  const description = `${succeededInvocationCount} succeeded, ${failedInvocationCount} failed`;
  const failedCountClassName = hasFailures
    ? "font-medium text-destructive"
    : "text-muted-foreground";

  return (
    <span className="tabular-nums" title={description}>
      {succeededInvocationCount}
      <span className="text-muted-foreground"> / </span>
      <span data-failed={hasFailures} className={failedCountClassName}>
        {failedInvocationCount}
      </span>
    </span>
  );
};

export const ViewExecutionLink = ({ href }: { href: string }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className="text-muted-foreground hover:text-foreground"
    >
      <Link href={href}>
        View
        <ChevronRight aria-hidden />
      </Link>
    </Button>
  );
};
