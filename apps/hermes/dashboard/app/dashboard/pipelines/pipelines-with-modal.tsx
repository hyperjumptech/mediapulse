"use client";

import { useEntityFormModal } from "@/components/entity-form-modal-provider";
import type { PipelineSummary } from "@/lib/pipeline-summaries";
import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import { PipelineFormModal } from "./pipeline-form-modal";
import { PipelinesTable } from "./pipelines-table";

export type PipelineDomainIntegrationOption = {
  id: string;
  integrationId: string;
  name: string;
};

export type PipelinesWithModalProps = {
  pipelines: PipelineSummary[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
  domainIntegrations: PipelineDomainIntegrationOption[];
};

export const PipelinesWithModal = ({
  pipelines,
  pipelineValidationById,
  domainIntegrations,
}: PipelinesWithModalProps) => {
  const { open, setOpen, mode, editId, openCreate, openEdit } =
    useEntityFormModal();

  return (
    <>
      <PipelinesTable
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
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
