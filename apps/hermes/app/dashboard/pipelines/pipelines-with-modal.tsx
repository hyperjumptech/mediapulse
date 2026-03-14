"use client";

import { useState } from "react";

import { Button } from "@workspace/ui/components/button";

import type { getPipelinesWithSteps } from "@/lib/pipelines";
import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import { PipelineFormModal } from "./pipeline-form-modal";
import { PipelinesTable } from "./pipelines-table";

type PipelineWithSteps = Awaited<
  ReturnType<typeof getPipelinesWithSteps>
>[number];

export type PipelinesWithModalProps = {
  pipelines: PipelineWithSteps[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
};

/**
 * Client wrapper that provides Create/Edit pipeline modals and wires table row Edit to open the modal.
 */
export const PipelinesWithModal = ({
  pipelines,
  pipelineValidationById,
}: PipelinesWithModalProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editPipelineId, setEditPipelineId] = useState<string | null>(null);

  const openCreateModal = () => {
    setModalMode("create");
    setEditPipelineId(null);
    setModalOpen(true);
  };

  const openEditModal = (pipelineId: string) => {
    setModalMode("edit");
    setEditPipelineId(pipelineId);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={openCreateModal}>Create pipeline</Button>
        </div>
        <PipelinesTable
          pipelines={pipelines}
          pipelineValidationById={pipelineValidationById}
          onEdit={openEditModal}
        />
      </div>
      <PipelineFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        editPipelineId={editPipelineId}
      />
    </>
  );
};
