"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  LoadExpansionsPageResult,
  LoadPageArgs,
  LoadVariablesPageResult,
} from "@workspace/variable-expansion-picker";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { formAction as defaultUpdatePipelineFormAction } from "@/app/dashboard/pipelines/actions/update/.generated/form.action";
import { formAction as defaultUpdateStepFormAction } from "@/app/dashboard/pipelines/actions/update-step/.generated/form.action";
import type { AgentConfigSummary } from "@/lib/agent-configs";
import type { PipelineExecutionRow } from "@/lib/pipeline-executions";
import type {
  getAgentRegistryList,
  getPipelineWithSteps,
} from "@/lib/pipelines";

import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import { PipelineAvailableAgents } from "./pipeline-available-agents";
import { PipelineExecutionsTable } from "./pipeline-executions-table";
import { PipelineStepEditorPanel } from "./pipeline-step-editor-panel";
import { PipelineStepsColumn } from "./pipeline-steps-column";
import { RunPipelineButton } from "./run-pipeline-button";
import { ListPagination } from "@/components/list-pagination";

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
  /** Optional DI: override for tests. Defaults to the generated update pipeline form action. */
  updatePipelineFormAction?: typeof defaultUpdatePipelineFormAction;
  /** Optional DI: override for tests. Defaults to the generated update step form action. */
  updateStepFormAction?: typeof defaultUpdateStepFormAction;
};

/**
 * Encapsulates pipeline detail state: selection, name/description, step input and agent-config picker, save logic, and sync effects.
 */
const usePipelineDetailState = (
  pipeline: PipelineWithSteps,
  updatePipelineFormAction: typeof defaultUpdatePipelineFormAction,
  updateStepFormAction: typeof defaultUpdateStepFormAction,
) => {
  const router = useRouter();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [pipelineName, setPipelineName] = useState(pipeline.name);
  const [pipelineDescription, setPipelineDescription] = useState(
    pipeline.description ?? "",
  );
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
    setPipelineName(pipeline.name);
    setPipelineDescription(pipeline.description ?? "");
  }, [pipeline.name, pipeline.description]);

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
    setSaveError(null);
    setSaveWarnings([]);
    setSaving(true);
    try {
      const pipelineFormData = new FormData();
      pipelineFormData.set("body.pipelineId", pipeline.id);
      pipelineFormData.set("body.name", pipelineName);
      pipelineFormData.set("body.description", pipelineDescription);
      const pipelineResult = await updatePipelineFormAction(
        null,
        pipelineFormData,
      );
      const pipelineOk =
        pipelineResult != null &&
        typeof pipelineResult === "object" &&
        "status" in pipelineResult &&
        (pipelineResult as { status: boolean }).status === true;
      if (!pipelineOk) {
        const msg =
          pipelineResult != null &&
          typeof pipelineResult === "object" &&
          "message" in pipelineResult
            ? String((pipelineResult as { message: unknown }).message)
            : "Failed to save pipeline";
        setSaveError(msg);
        return;
      }

      if (selectedStep) {
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
      }

      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [
    pipeline.id,
    pipelineName,
    pipelineDescription,
    selectedStep,
    stepInput,
    stepAgentConfigId,
    router,
    updatePipelineFormAction,
    updateStepFormAction,
  ]);

  return {
    selectedStepId,
    setSelectedStepId,
    pipelineName,
    setPipelineName,
    pipelineDescription,
    setPipelineDescription,
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
 * Client wrapper for pipeline detail: name/description and Save above; three-column layout
 * (available agents | pipeline steps | agent input/config only). Save beside Run pipeline.
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
  updatePipelineFormAction = defaultUpdatePipelineFormAction,
  updateStepFormAction = defaultUpdateStepFormAction,
}: PipelineDetailContentProps) => {
  const {
    selectedStepId,
    setSelectedStepId,
    pipelineName,
    setPipelineName,
    pipelineDescription,
    setPipelineDescription,
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
  } = usePipelineDetailState(
    pipeline,
    updatePipelineFormAction,
    updateStepFormAction,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="pipeline-name">Pipeline name</Label>
            <Input
              id="pipeline-name"
              type="text"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              disabled={saving}
              className="text-lg font-semibold"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pipeline-description">Description (optional)</Label>
            <Input
              id="pipeline-description"
              type="text"
              value={pipelineDescription}
              onChange={(e) => setPipelineDescription(e.target.value)}
              disabled={saving}
              placeholder="Edit pipeline and manage agent steps."
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RunPipelineButton
            pipelineId={pipeline.id}
            disabled={!pipelineValidation.valid}
          />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
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
              <ul className="list-disc pl-4 mt-1">
                {saveWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!pipelineValidation.valid &&
          pipelineValidation.warnings.length > 0 ? (
            <div
              className="w-full text-sm text-amber-600 dark:text-amber-500"
              role="status"
            >
              <p className="font-medium">Pipeline incomplete (Run disabled):</p>
              <ul className="list-disc pl-4 mt-1">
                {pipelineValidation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

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
