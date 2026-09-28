"use client";

import { useEntityFormModal } from "@/components/entity-form-modal-provider";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import type { PipelineOption } from "./schedule-form-fields";
import { ScheduleFormModal } from "./schedule-form-modal";
import { SchedulesTable, type ScheduleRow } from "./schedules-table";

export type SchedulesWithModalProps = {
  schedules: ScheduleRow[];
  pipelines: PipelineOption[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
  urlState: ListUrlState;
  initialColumnVisibility?: ColumnVisibility;
};

export const SchedulesWithModal = ({
  schedules,
  pipelines,
  pipelineValidationById,
  urlState,
  initialColumnVisibility,
}: SchedulesWithModalProps) => {
  const { open, setOpen, mode, editId, openCreate, openEdit } =
    useEntityFormModal();

  return (
    <>
      <SchedulesTable
        schedules={schedules}
        urlState={urlState}
        onEdit={openEdit}
        onCreate={openCreate}
        initialColumnVisibility={initialColumnVisibility}
      />
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
