"use client";

import { useEntityFormModal } from "@/components/entity-form-modal-provider";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import type { ListUrlState } from "@/lib/data-table/list-url-state";

import type { PipelineOption } from "../schedules/schedule-form-fields";
import { HttpTriggerFormModal } from "./http-trigger-form-modal";
import { HttpTriggersTable, type HttpTriggerRow } from "./http-triggers-table";

export type HttpTriggersWithModalProps = {
  httpTriggers: HttpTriggerRow[];
  pipelines: PipelineOption[];
  urlState: ListUrlState;
  initialColumnVisibility?: ColumnVisibility;
};

export const HttpTriggersWithModal = ({
  httpTriggers,
  pipelines,
  urlState,
  initialColumnVisibility,
}: HttpTriggersWithModalProps) => {
  const { open, setOpen, mode, editId, openCreate, openEdit } =
    useEntityFormModal();

  return (
    <>
      <HttpTriggersTable
        httpTriggers={httpTriggers}
        urlState={urlState}
        onEdit={openEdit}
        onCreate={openCreate}
        initialColumnVisibility={initialColumnVisibility}
      />
      <HttpTriggerFormModal
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        editHttpTriggerId={editId}
        pipelines={pipelines}
      />
    </>
  );
};
