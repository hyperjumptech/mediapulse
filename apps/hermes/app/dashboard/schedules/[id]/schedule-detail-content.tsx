"use client";

import Link from "next/link";

import { useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { ChevronLeft } from "lucide-react";

import type { getScheduleById, ScheduleExecutionRow } from "@/lib/schedules";
import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import { ListPagination } from "@/components/list-pagination";
import { ScheduleFormModal } from "../schedule-form-modal";
import type { PipelineOption } from "../schedule-form-fields";
import { ExecutionsTable } from "./executions-table";

type ScheduleWithPipeline = NonNullable<
  Awaited<ReturnType<typeof getScheduleById>>
>;

export type ScheduleDetailContentProps = {
  schedule: ScheduleWithPipeline;
  executions: ScheduleExecutionRow[];
  totalExecutions: number;
  currentPage: number;
  pageSize: number;
  pipelines: PipelineOption[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
};

/**
 * Encapsulates schedule detail edit modal state.
 */
const useScheduleDetailContentState = () => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  return { editModalOpen, setEditModalOpen };
};

/**
 * Client wrapper for schedule detail: back link, header with Edit schedule button, executions table, and pagination.
 */
export const ScheduleDetailContent = ({
  schedule,
  executions,
  totalExecutions,
  currentPage,
  pageSize,
  pipelines,
  pipelineValidationById,
}: ScheduleDetailContentProps) => {
  const { editModalOpen, setEditModalOpen } = useScheduleDetailContentState();

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/dashboard/schedules"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back to schedules
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {schedule.name}
            </h1>
            <p className="text-muted-foreground">
              {schedule.description ??
                "View executions and edit schedule settings."}
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditModalOpen(true)}>
            Edit schedule
          </Button>
        </div>

        <section>
          <h2 className="mb-2 text-lg font-medium text-foreground">
            Executions
          </h2>
          <ExecutionsTable executions={executions} />
          <div className="mt-4">
            <ListPagination
              basePath={`/dashboard/schedules/${schedule.id}`}
              page={currentPage}
              pageSize={pageSize}
              total={totalExecutions}
              ariaLabel="Executions pagination"
            />
          </div>
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
