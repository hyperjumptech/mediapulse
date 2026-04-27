"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  LoadExpansionsPageResult,
  LoadPageArgs,
  LoadVariablesPageResult,
} from "@workspace/variable-expansion-picker";
import { Button } from "@workspace/ui/components/button";

import { formAction as defaultUpdateStepFormAction } from "@/app/dashboard/pipelines/actions/update-step/.generated/form.action";
import type { AgentConfigSummary } from "@/lib/agent-configs";
import type { PipelineExecutionRow } from "@/lib/pipeline-executions";
import type {
  getAgentRegistryList,
  getPipelineWithSteps,
} from "@/lib/pipelines";

import { getPipelineStatus } from "@/lib/pipeline-status";
import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import { PipelineAvailableAgents } from "./pipeline-available-agents";
import { PipelineExecutionsTable } from "./pipeline-executions-table";
import { PipelineStepEditorPanel } from "./pipeline-step-editor-panel";
import { PipelineStepsColumn } from "./pipeline-steps-column";
import { RunPipelineButton } from "./run-pipeline-button";
import { ListPagination } from "@/components/list-pagination";
import { PipelineFormModal } from "../pipeline-form-modal";
import { PipelineStatusBadge } from "../pipeline-status-badge";

type PipelineWithSteps = NonNullable<
  Awaited<ReturnType<typeof getPipelineWithSteps>>
>;
type AgentRegistryEntry = Awaited<
  ReturnType<typeof getAgentRegistryList>
>[number];

export type PipelineDetailContentProps = {
  pipeline: PipelineWithSteps;
  agents: AgentRegistryEntry[];
  configsByAgentKey: Record<string, AgentConfigSummary[]>;
  pipelineValidation: PipelineValidationResult;
  executions: PipelineExecutionRow[];
  totalExecutions: number;
  currentPage: number;
  pageSize: number;
  /** Server action: paginated variable keys for the step editor picker. */
  loadVariablePickerPage: (
    args: LoadPageArgs,
  ) => Promise<LoadVariablesPageResult>;
  /** Server action: paginated expansions for the step editor picker. */
  loadExpansionPickerPage: (
    args: LoadPageArgs,
  ) => Promise<LoadExpansionsPageResult>;
  /** Optional DI: override for tests. Defaults to the generated update step form action. */
  updateStepFormAction?: typeof defaultUpdateStepFormAction;
};

/**
 * Encapsulates pipeline detail state: step selection, step input and agent-config picker, and save logic.
 */
const usePipelineDetailState = (
  pipeline: PipelineWithSteps,
  updateStepFormAction: typeof defaultUpdateStepFormAction,
) => {
  const router = useRouter();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepInput, setStepInput] = useState<Record<string, unknown>>({});
  const [stepAgentConfigId, setStepAgentConfigId] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedStep = useMemo(
    () => pipeline.steps.find((s) => s.id === selectedStepId) ?? null,
    [pipeline.steps, selectedStepId],
  );

  const existingStepAgentKeys = useMemo(
    () => pipeline.steps.map((s) => `${s.agentId}@${s.agentVersion}`),
    [pipeline.steps],
  );

  useEffect(() => {
    if (!selectedStep) {
      setStepInput({});
      setStepAgentConfigId("");
      return;
    }
    const rawInput =
      selectedStep.input != null &&
      typeof selectedStep.input === "object" &&
      !Array.isArray(selectedStep.input)
        ? (selectedStep.input as Record<string, unknown>)
        : {};
    setStepInput(rawInput);
    setStepAgentConfigId(selectedStep.agentConfigId ?? "");
  }, [selectedStep]);

  const handleSave = useCallback(async () => {
    if (!selectedStep) return;

    setSaveError(null);
    setSaveWarnings([]);
    setSaving(true);
    try {
      const stepFormData = new FormData();
      stepFormData.set("body.pipelineId", pipeline.id);
      stepFormData.set("body.stepId", selectedStep.id);
      stepFormData.set("body.agentId", selectedStep.agentId);
      stepFormData.set("body.agentVersion", selectedStep.agentVersion);
      stepFormData.set("body.agentConfigId", stepAgentConfigId);
      stepFormData.set("body.input", JSON.stringify(stepInput));
      stepFormData.set("body.config", "{}");
      const stepResult = await updateStepFormAction(null, stepFormData);
      const stepOk =
        stepResult != null &&
        typeof stepResult === "object" &&
        "status" in stepResult &&
        (stepResult as { status: boolean }).status === true;
      if (!stepOk) {
        const msg =
          stepResult != null &&
          typeof stepResult === "object" &&
          "message" in stepResult
            ? String((stepResult as { message: unknown }).message)
            : "Failed to save step";
        setSaveError(msg);
        return;
      }
      const warnings =
        stepResult != null &&
        typeof stepResult === "object" &&
        "data" in stepResult &&
        stepResult.data != null &&
        typeof stepResult.data === "object" &&
        "validationWarnings" in stepResult.data &&
        Array.isArray(
          (stepResult.data as { validationWarnings?: string[] })
            .validationWarnings,
        )
          ? (stepResult.data as { validationWarnings: string[] })
              .validationWarnings
          : [];
      setSaveWarnings(warnings);

      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [
    pipeline.id,
    selectedStep,
    stepInput,
    stepAgentConfigId,
    router,
    updateStepFormAction,
  ]);

  return {
    selectedStepId,
    setSelectedStepId,
    stepInput,
    setStepInput,
    stepAgentConfigId,
    setStepAgentConfigId,
    saveError,
    saveWarnings,
    saving,
    selectedStep,
    existingStepAgentKeys,
    handleSave,
  };
};

/**
 * Owns the edit-pipeline modal open state for the detail page toolbar.
 */
const usePipelineEditModalState = () => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  return { editModalOpen, setEditModalOpen };
};

/**
 * Client wrapper for pipeline detail: read-only title/description, status, and actions; three-column step editor; executions.
 */
export const PipelineDetailContent = ({
  pipeline,
  agents,
  configsByAgentKey,
  pipelineValidation,
  executions,
  totalExecutions,
  currentPage,
  pageSize,
  loadVariablePickerPage,
  loadExpansionPickerPage,
  updateStepFormAction = defaultUpdateStepFormAction,
}: PipelineDetailContentProps) => {
  const {
    selectedStepId,
    setSelectedStepId,
    stepInput,
    setStepInput,
    stepAgentConfigId,
    setStepAgentConfigId,
    saveError,
    saveWarnings,
    saving,
    selectedStep,
    existingStepAgentKeys,
    handleSave,
  } = usePipelineDetailState(pipeline, updateStepFormAction);

  const { editModalOpen, setEditModalOpen } = usePipelineEditModalState();

  const pipelineStatus = getPipelineStatus(pipeline, pipelineValidation);
  const statusWord =
    pipelineStatus === "incomplete"
      ? "Incomplete"
      : pipelineStatus === "disabled"
        ? "Disabled"
        : "Enabled";

  const descriptionText = pipeline.description?.trim() ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {pipeline.name}
            </h1>
            <span
              className="shrink-0"
              role="status"
              aria-label={`Pipeline status ${statusWord}`}
            >
              <PipelineStatusBadge status={pipelineStatus} />
            </span>
          </div>
          {descriptionText !== "" ? (
            <p className="text-sm text-muted-foreground">{descriptionText}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No description
            </p>
          )}
        </div>
        <div className="flex w-full justify-end lg:w-auto lg:shrink-0">
          <RunPipelineButton
            className="w-full min-[480px]:w-auto"
            pipelineId={pipeline.id}
            disabled={!pipelineValidation.valid}
            trailingActions={
              <>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || selectedStep == null}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button type="button" onClick={() => setEditModalOpen(true)}>
                  Edit pipeline
                </Button>
              </>
            }
          />
        </div>
      </div>

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}
      {saveWarnings.length > 0 ? (
        <div
          className="w-full text-sm text-amber-600 dark:text-amber-500"
          role="alert"
        >
          <p className="font-medium">Saved with warnings:</p>
          <ul className="mt-1 list-disc pl-4">
            {saveWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!pipelineValidation.valid && pipelineValidation.warnings.length > 0 ? (
        <div
          className="w-full text-sm text-amber-600 dark:text-amber-500"
          role="status"
        >
          <p className="font-medium">Pipeline incomplete (Run disabled):</p>
          <ul className="mt-1 list-disc pl-4">
            {pipelineValidation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <PipelineFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        editPipelineId={pipeline.id}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
          <PipelineAvailableAgents
            pipelineId={pipeline.id}
            agents={agents}
            existingStepAgentKeys={existingStepAgentKeys}
          />
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
          <PipelineStepsColumn
            pipelineId={pipeline.id}
            steps={pipeline.steps}
            agentDescriptions={agents}
            selectedStepId={selectedStepId}
            onSelectStep={setSelectedStepId}
            configsByAgentKey={configsByAgentKey}
          />
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
          <PipelineStepEditorPanel
            selectedStep={selectedStep}
            stepInput={stepInput}
            onStepInputChange={setStepInput}
            configsForAgent={
              selectedStep
                ? (configsByAgentKey[
                    `${selectedStep.agentId}@${selectedStep.agentVersion}`
                  ] ?? [])
                : []
            }
            stepAgentConfigId={stepAgentConfigId}
            onStepAgentConfigIdChange={setStepAgentConfigId}
            disabled={saving}
            loadVariablePickerPage={loadVariablePickerPage}
            loadExpansionPickerPage={loadExpansionPickerPage}
          />
        </div>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-medium text-foreground">Executions</h2>
        <PipelineExecutionsTable
          pipelineId={pipeline.id}
          executions={executions}
        />
        <div className="mt-4">
          <ListPagination
            basePath={`/dashboard/pipelines/${pipeline.id}`}
            page={currentPage}
            pageSize={pageSize}
            total={totalExecutions}
            ariaLabel="Pipeline executions pagination"
          />
        </div>
      </section>
    </div>
  );
};
