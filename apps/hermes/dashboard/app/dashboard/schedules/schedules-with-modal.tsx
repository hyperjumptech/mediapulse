"use client";

import { useEntityFormModal } from "@/components/entity-form-modal-provider";
import { ListPagination } from "@/components/list-pagination";
import type {
  ScheduleSortDir,
  ScheduleSortField,
  SchedulesPageResult,
} from "@/lib/schedules";
import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import type { PipelineOption } from "./schedule-form-fields";
import { ScheduleFormModal } from "./schedule-form-modal";
import { SchedulesSearch } from "./schedules-search";
import { SchedulesTable } from "./schedules-table";

type ScheduleRow = SchedulesPageResult["schedules"][number];

export type SchedulesWithModalProps = {
  schedules: ScheduleRow[];
  pipelines: PipelineOption[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
  currentPage: number;
  pageSize: number;
  total: number;
  searchQuery?: string;
  sortBy: ScheduleSortField;
  sortDir: ScheduleSortDir;
};

export const SchedulesWithModal = ({
  schedules,
  pipelines,
  pipelineValidationById,
  currentPage,
  pageSize,
  total,
  searchQuery,
  sortBy,
  sortDir,
}: SchedulesWithModalProps) => {
  const { open, setOpen, mode, editId, openCreate, openEdit } =
    useEntityFormModal();

  return (
    <>
      <div className="flex flex-col gap-3">
        <SchedulesSearch
          initialQuery={searchQuery ?? ""}
          pageSize={pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <SchedulesTable
          schedules={schedules}
          sortBy={sortBy}
          sortDir={sortDir}
          pageSize={pageSize}
          searchQuery={searchQuery}
          onEdit={openEdit}
          onCreate={openCreate}
        />
        <ListPagination
          basePath="/dashboard/schedules"
          page={currentPage}
          pageSize={pageSize}
          total={total}
          ariaLabel="Schedules list pagination"
          searchQuery={searchQuery}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>
      <ScheduleFormModal
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        editScheduleId={editId}
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />
    </>
  );
};
