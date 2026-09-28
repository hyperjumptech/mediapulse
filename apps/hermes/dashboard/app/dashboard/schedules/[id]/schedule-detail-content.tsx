"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { BreadcrumbEntityLabel } from "@/components/breadcrumb-entity-label";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
import { StatusBadge } from "@/components/status-badge";
import { SummaryGrid, SummaryItem } from "@/components/summary-grid";
import { formatCreatedBy } from "@/lib/format-created-by";
import type { getScheduleById } from "@/lib/schedules";
import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import { describeScheduleCadence } from "../describe-schedule-cadence";
import type { PipelineOption } from "../schedule-form-fields";
import { ScheduleFormModal } from "../schedule-form-modal";

type ScheduleWithPipeline = NonNullable<
  Awaited<ReturnType<typeof getScheduleById>>
>;

export type ScheduleDetailContentProps = {
  schedule: ScheduleWithPipeline;
  executionsSection: ReactNode;
  pipelines: PipelineOption[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
};

const SCHEDULE_TIMESTAMP_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const useScheduleDetailContentState = () => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const openEditModal = () => setEditModalOpen(true);

  return { editModalOpen, setEditModalOpen, openEditModal };
};

const formatInScheduleTimezone = (date: Date, timezone: string): string => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...SCHEDULE_TIMESTAMP_FORMAT_OPTIONS,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      ...SCHEDULE_TIMESTAMP_FORMAT_OPTIONS,
      timeZone: "UTC",
    }).format(date);
  }
};

const describeMissedRuns = (missedRunCount: number) =>
  missedRunCount === 1
    ? "Skipped 1 missed run"
    : `Skipped ${missedRunCount} missed runs`;

const ScheduleCadenceValue = ({
  schedule,
}: {
  schedule: ScheduleWithPipeline;
}) => {
  const cadence = describeScheduleCadence(schedule);

  if (cadence.isCronExpression) {
    return <code className="font-mono text-xs">{cadence.label}</code>;
  }

  return <span>{cadence.label}</span>;
};

const NextRunValue = ({ schedule }: { schedule: ScheduleWithPipeline }) => {
  if (!schedule.enabled) {
    return <span className="text-muted-foreground">Not while disabled</span>;
  }
  if (!schedule.nextRunAt) {
    return <span className="text-muted-foreground">None scheduled</span>;
  }
  const absoluteLabel = formatInScheduleTimezone(
    schedule.nextRunAt,
    schedule.timezone,
  );

  return (
    <span className="flex flex-col">
      <RelativeTime value={schedule.nextRunAt} className="font-medium" />
      <span className="text-xs text-muted-foreground tabular-nums">
        {absoluteLabel}
      </span>
    </span>
  );
};

const LastRecoveredValue = ({
  lastRecoveredAt,
  lastMissedRunCount,
}: {
  lastRecoveredAt: Date;
  lastMissedRunCount: number | null;
}) => {
  const missedRunsLabel =
    lastMissedRunCount != null ? describeMissedRuns(lastMissedRunCount) : null;

  return (
    <span className="flex flex-col">
      <RelativeTime value={lastRecoveredAt} />
      {missedRunsLabel ? (
        <span className="text-xs text-muted-foreground">{missedRunsLabel}</span>
      ) : null}
    </span>
  );
};

export const ScheduleDetailContent = ({
  schedule,
  executionsSection,
  pipelines,
  pipelineValidationById,
}: ScheduleDetailContentProps) => {
  const { editModalOpen, setEditModalOpen, openEditModal } =
    useScheduleDetailContentState();
  const enabledStatus = schedule.enabled ? "enabled" : "disabled";
  const pipelineHref = `/dashboard/pipelines/${schedule.pipeline.id}`;
  const createdBy = formatCreatedBy(schedule.createdBy, schedule.createdById);
  const description = schedule.description ?? undefined;

  return (
    <>
      <BreadcrumbEntityLabel segment={schedule.id} label={schedule.name} />
      <div className="flex flex-col gap-6">
        <PageHeader
          title={schedule.name}
          badges={<StatusBadge status={enabledStatus} />}
          description={description}
          actions={
            <Button type="button" variant="outline" onClick={openEditModal}>
              <Pencil aria-hidden />
              Edit schedule
            </Button>
          }
        />
        <SummaryGrid>
          <SummaryItem label="Pipeline">
            <Link
              href={pipelineHref}
              className="font-medium underline-offset-4 hover:underline"
            >
              {schedule.pipeline.name}
            </Link>
          </SummaryItem>
          <SummaryItem label="Repeats">
            <ScheduleCadenceValue schedule={schedule} />
          </SummaryItem>
          <SummaryItem label="Timezone">{schedule.timezone}</SummaryItem>
          <SummaryItem label="Next run">
            <NextRunValue schedule={schedule} />
          </SummaryItem>
          <SummaryItem label="Created">
            <RelativeTime value={schedule.createdAt} />
          </SummaryItem>
          <SummaryItem label="Created by">{createdBy}</SummaryItem>
          {schedule.lastRecoveredAt ? (
            <SummaryItem label="Last recovered">
              <LastRecoveredValue
                lastRecoveredAt={schedule.lastRecoveredAt}
                lastMissedRunCount={schedule.lastMissedRunCount}
              />
            </SummaryItem>
          ) : null}
        </SummaryGrid>
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Executions
          </h2>
          {executionsSection}
        </section>
      </div>
      <ScheduleFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        editScheduleId={schedule.id}
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />
    </>
  );
};
