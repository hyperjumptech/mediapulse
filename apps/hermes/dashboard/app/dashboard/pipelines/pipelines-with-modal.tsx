"use client";

import { useEntityFormModal } from "@/components/entity-form-modal-provider";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import type { PipelineSummary } from "@/lib/pipeline-summaries";

import { PipelineFormModal } from "./pipeline-form-modal";
import { PipelinesTable } from "./pipelines-table";

export type PipelineDomainIntegrationOption = {
  id: string;
  integrationId: string;
  name: string;
};

export type PipelinesWithModalProps = {
  pipelines: PipelineSummary[];
  urlState: ListUrlState;
  initialColumnVisibility?: ColumnVisibility;
  domainIntegrations: PipelineDomainIntegrationOption[];
};

export const PipelinesWithModal = ({
  pipelines,
  urlState,
  initialColumnVisibility,
  domainIntegrations,
}: PipelinesWithModalProps) => {
  const { open, setOpen, mode, editId, openCreate, openEdit } =
    useEntityFormModal();

  return (
    <>
      <PipelinesTable
        pipelines={pipelines}
        urlState={urlState}
        initialColumnVisibility={initialColumnVisibility}
        onEdit={openEdit}
        onCreate={openCreate}
      />
      <PipelineFormModal
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        editPipelineId={editId}
        domainIntegrations={domainIntegrations}
      />
    </>
  );
};
