"use server";

import { getPipelineWithSteps } from "@/lib/pipelines";

/**
 * Serializable pipeline shape for the create/edit form modal.
 */
export type PipelineForEdit = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

/**
 * Fetches a pipeline by id for the edit modal. Returns only fields needed for the form.
 * Returns null if not found.
 *
 * @param pipelineId - UUID of the pipeline.
 * @returns Serialized pipeline or null.
 */
export const getPipelineForEdit = async (
  pipelineId: string,
): Promise<PipelineForEdit | null> => {
  const pipeline = await getPipelineWithSteps(pipelineId);
  if (!pipeline) return null;
  return {
    id: pipeline.id,
    name: pipeline.name,
    description: pipeline.description,
    isActive: pipeline.isActive,
  };
};
