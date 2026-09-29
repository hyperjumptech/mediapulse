"use client";

import { useCallback, useEffect, useState } from "react";

import type { formAction as updatePipelineStepFormAction } from "@/app/dashboard/pipelines/actions/update-pipeline-step/.generated/form.action";

export type UpdatePipelineStepFormAction = typeof updatePipelineStepFormAction;

export type EditablePipelineStep = {
  id: string;
  targetPipelineId: string | null;
  input: unknown;
};

type SaveOutcome =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "failed"; message: string };

const formatOverrides = (input: unknown): string =>
  JSON.stringify(input ?? {}, null, 2);

const readSaveOutcome = (result: unknown): SaveOutcome => {
  const isFailed =
    result != null &&
    typeof result === "object" &&
    "status" in result &&
    result.status === false;
  if (!isFailed) {
    return { status: "saved" };
  }
  const message =
    "message" in result ? String(result.message) : "Step not saved";

  return { status: "failed", message };
};

export const usePipelineStepTargetEditorState = (
  pipelineId: string,
  step: EditablePipelineStep,
  updatePipelineStepFormAction: UpdatePipelineStepFormAction,
) => {
  const [targetPipelineId, setTargetPipelineId] = useState(
    step.targetPipelineId ?? "",
  );
  const [overridesText, setOverridesText] = useState(
    formatOverrides(step.input),
  );
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome>({ status: "idle" });

  const savedOverridesText = formatOverrides(step.input);

  useEffect(() => {
    setTargetPipelineId(step.targetPipelineId ?? "");
    setOverridesText(savedOverridesText);
  }, [step.id, step.targetPipelineId, savedOverridesText]);

  useEffect(() => {
    setOutcome({ status: "idle" });
  }, [step.id]);

  const save = useCallback(async () => {
    setSaving(true);
    setOutcome({ status: "idle" });
    try {
      const formData = new FormData();
      formData.set("body.pipelineId", pipelineId);
      formData.set("body.stepId", step.id);
      formData.set("body.targetPipelineId", targetPipelineId);
      formData.set("body.input", overridesText);
      const result = await updatePipelineStepFormAction(null, formData);
      setOutcome(readSaveOutcome(result));
    } finally {
      setSaving(false);
    }
  }, [
    pipelineId,
    step.id,
    targetPipelineId,
    overridesText,
    updatePipelineStepFormAction,
  ]);

  return {
    targetPipelineId,
    setTargetPipelineId,
    overridesText,
    setOverridesText,
    saving,
    outcome,
    save,
  };
};
