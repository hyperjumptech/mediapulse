"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, Pencil, TriangleAlert } from "lucide-react";

import type {
  LoadExpansionsPageResult,
  LoadPageArgs,
  LoadVariablesPageResult,
} from "@workspace/variable-expansion-picker";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";

import { formAction as defaultUpdateStepFormAction } from "@/app/dashboard/pipelines/actions/update-step/.generated/form.action";
import { BreadcrumbEntityLabel } from "@/components/breadcrumb-entity-label";
import { PageHeader } from "@/components/page-header";
import { DateTime } from "@/components/date-time/date-time";
import { SummaryGrid, SummaryItem } from "@/components/summary-grid";
import type { AgentConfigSummary } from "@/lib/agent-configs";
import type { AgentContractSummary } from "@/lib/agent-contracts";
import {
  DEFAULT_PIPELINE_TIMEOUT_MS,
  formatMsDuration,
} from "@/lib/format-pipeline-timeout-preview";
import { getPipelineStatus } from "@/lib/pipeline-status";
import type {
  getAgentRegistryList,
  getPipelineWithSteps,
} from "@/lib/pipelines";
import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import { PipelineFormModal } from "../pipeline-form-modal";
import { PipelineStatusBadge } from "../pipeline-status-badge";
import type { PipelineDomainIntegrationOption } from "../pipelines-with-modal";
import { PipelineAvailableAgents } from "./pipeline-available-agents";
import { PipelineColumnCard } from "./pipeline-column-card";
import { PipelineStepEditorPanel } from "./pipeline-step-editor-panel";
import { PipelineStepsColumn } from "./pipeline-steps-column";
import {
  RunPipelineButton,
  RunPipelineResult,
  useRunPipeline,
} from "./run-pipeline-button";

type PipelineWithSteps = NonNullable<
  Awaited<ReturnType<typeof getPipelineWithSteps>>
>;
type AgentRegistryEntry = Awaited<
  ReturnType<typeof getAgentRegistryList>
>[number];
type UpdateStepFormAction = typeof defaultUpdateStepFormAction;
type LoadVariablePickerPage = (
  args: LoadPageArgs,
) => Promise<LoadVariablesPageResult>;
type LoadExpansionPickerPage = (
  args: LoadPageArgs,
) => Promise<LoadExpansionsPageResult>;

export type PipelineDetailContentProps = {
  pipeline: PipelineWithSteps;
  agents: AgentRegistryEntry[];
  domainIntegrations: PipelineDomainIntegrationOption[];
  configsByAgentKey: Record<string, AgentConfigSummary[]>;
  allContracts: AgentContractSummary[];
  pipelineValidation: PipelineValidationResult;
  executionsSection: ReactNode;
  loadVariablePickerPage: LoadVariablePickerPage;
  loadExpansionPickerPage: LoadExpansionPickerPage;
  updateStepFormAction?: UpdateStepFormAction;
};

type StepSaveOutcome =
  | { saved: true; warnings: string[] }
  | { saved: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

const readStepSaveOutcome = (stepResult: unknown): StepSaveOutcome => {
  if (!isRecord(stepResult) || stepResult.status !== true) {
    const message =
      isRecord(stepResult) && "message" in stepResult
        ? String(stepResult.message)
        : "Failed to save step";

    return { saved: false, message };
  }
  const resultData = stepResult.data;
  const validationWarnings = isRecord(resultData)
    ? resultData.validationWarnings
    : undefined;
  const warnings = Array.isArray(validationWarnings)
    ? validationWarnings.map(String)
    : [];

  return { saved: true, warnings };
};

const buildUpdateStepFormData = (
  pipelineId: string,
  step: PipelineWithSteps["steps"][number],
  stepAgentConfigId: string,
  stepAgentContractId: string,
  stepInput: Record<string, unknown>,
): FormData => {
  const stepFormData = new FormData();
  stepFormData.set("body.pipelineId", pipelineId);
  stepFormData.set("body.stepId", step.id);
  stepFormData.set("body.agentId", step.agentId);
  stepFormData.set("body.agentVersion", step.agentVersion);
  stepFormData.set("body.agentConfigId", stepAgentConfigId);
  stepFormData.set("body.agentContractId", stepAgentContractId);
  stepFormData.set("body.input", JSON.stringify(stepInput));
  stepFormData.set("body.config", "{}");

  return stepFormData;
};

const describeAgentTimeout = (timeoutMilliseconds: number | null) =>
  timeoutMilliseconds != null && timeoutMilliseconds > 0
    ? formatMsDuration(timeoutMilliseconds)
    : `${formatMsDuration(DEFAULT_PIPELINE_TIMEOUT_MS)} (default)`;

const usePipelineDetailState = (
  pipeline: PipelineWithSteps,
  updateStepFormAction: UpdateStepFormAction,
) => {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepInput, setStepInput] = useState<Record<string, unknown>>({});
  const [stepAgentConfigId, setStepAgentConfigId] = useState<string>("");
  const [stepAgentContractId, setStepAgentContractId] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedStep = useMemo(
    () => pipeline.steps.find((step) => step.id === selectedStepId) ?? null,
    [pipeline.steps, selectedStepId],
  );

  const existingStepAgentKeys = useMemo(
    () => pipeline.steps.map((step) => `${step.agentId}@${step.agentVersion}`),
    [pipeline.steps],
  );

  useEffect(() => {
    if (!selectedStep) {
      setStepInput({});
      setStepAgentConfigId("");

      return;
    }
    const savedInput = isRecord(selectedStep.input) ? selectedStep.input : {};
    setStepInput(savedInput);
    setStepAgentConfigId(selectedStep.agentConfigId ?? "");
    setStepAgentContractId(selectedStep.agentContractId ?? "");
  }, [selectedStep]);

  const handleSave = useCallback(async () => {
    if (!selectedStep) {
      return;
    }
    setSaveError(null);
    setSaveWarnings([]);
    if (stepAgentConfigId === "" || stepAgentContractId === "") {
      setSaveError("Agent config and Agent contract are required.");

      return;
    }
    setSaving(true);
    try {
      const stepFormData = buildUpdateStepFormData(
        pipeline.id,
        selectedStep,
        stepAgentConfigId,
        stepAgentContractId,
        stepInput,
      );
      const stepResult = await updateStepFormAction(null, stepFormData);
      const outcome = readStepSaveOutcome(stepResult);
      if (!outcome.saved) {
        setSaveError(outcome.message);

        return;
      }
      setSaveWarnings(outcome.warnings);
    } finally {
      setSaving(false);
    }
  }, [
    pipeline.id,
    selectedStep,
    stepInput,
    stepAgentConfigId,
    stepAgentContractId,
    updateStepFormAction,
  ]);

  return {
    selectedStepId,
    setSelectedStepId,
    stepInput,
    setStepInput,
    stepAgentConfigId,
    setStepAgentConfigId,
    stepAgentContractId,
    setStepAgentContractId,
    saveError,
    saveWarnings,
    saving,
    selectedStep,
    existingStepAgentKeys,
    handleSave,
  };
};

const usePipelineEditModalState = () => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const openEditModal = () => setEditModalOpen(true);

  return { editModalOpen, setEditModalOpen, openEditModal };
};

const PipelineValidationAlert = ({ warnings }: { warnings: string[] }) => {
  return (
    <Alert className="border-warning/40 bg-warning/10 [&>svg]:text-warning">
      <TriangleAlert aria-hidden />
      <AlertTitle>Pipeline incomplete, so it can&apos;t run yet</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-0.5 pl-4">
          {warnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};

const StepSaveFeedback = ({
  saveError,
  saveWarnings,
}: {
  saveError: string | null;
  saveWarnings: string[];
}) => {
  if (saveError) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertTitle>Step not saved</AlertTitle>
        <AlertDescription>{saveError}</AlertDescription>
      </Alert>
    );
  }
  if (saveWarnings.length === 0) {
    return null;
  }

  return (
    <Alert className="border-warning/40 bg-warning/10 [&>svg]:text-warning">
      <TriangleAlert aria-hidden />
      <AlertTitle>Saved with warnings</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-0.5 pl-4">
          {saveWarnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};

export const PipelineDetailContent = ({
  pipeline,
  agents,
  domainIntegrations,
  configsByAgentKey,
  allContracts,
  pipelineValidation,
  executionsSection,
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
    stepAgentContractId,
    setStepAgentContractId,
    saveError,
    saveWarnings,
    saving,
    selectedStep,
    existingStepAgentKeys,
    handleSave,
  } = usePipelineDetailState(pipeline, updateStepFormAction);
  const { editModalOpen, setEditModalOpen, openEditModal } =
    usePipelineEditModalState();
  const runPipelineAction = useRunPipeline();

  const pipelineStatus = getPipelineStatus(pipeline, pipelineValidation);
  const description = pipeline.description?.trim() || undefined;
  const showValidationWarnings =
    !pipelineValidation.valid && pipelineValidation.warnings.length > 0;
  const integrationName =
    domainIntegrations.find(
      (integration) => integration.id === pipeline.domainIntegrationId,
    )?.name ?? pipeline.domainIntegrationId;
  const selectedStepAgentKey = selectedStep
    ? `${selectedStep.agentId}@${selectedStep.agentVersion}`
    : null;
  const configsForSelectedAgent = selectedStepAgentKey
    ? (configsByAgentKey[selectedStepAgentKey] ?? [])
    : [];
  const selectedStepDescription = selectedStepAgentKey ? (
    <span className="font-mono">{selectedStepAgentKey}</span>
  ) : (
    "Select a step to edit it."
  );
  const saveLabel = saving ? "Saving…" : "Save";

  return (
    <div className="flex flex-col gap-6">
      <BreadcrumbEntityLabel segment={pipeline.id} label={pipeline.name} />
      <PageHeader
        badges={<PipelineStatusBadge status={pipelineStatus} />}
        description={description}
        actions={
          <>
            <Button type="button" variant="outline" onClick={openEditModal}>
              <Pencil aria-hidden />
              Edit pipeline
            </Button>
            <RunPipelineButton
              pipelineId={pipeline.id}
              disabled={!pipelineValidation.valid}
              runPipelineAction={runPipelineAction}
            />
          </>
        }
      />
      {showValidationWarnings ? (
        <PipelineValidationAlert warnings={pipelineValidation.warnings} />
      ) : null}
      <RunPipelineResult
        pipelineId={pipeline.id}
        state={runPipelineAction.state}
      />
      <SummaryGrid>
        <SummaryItem label="Integration">{integrationName}</SummaryItem>
        <SummaryItem label="Agent timeout">
          {describeAgentTimeout(pipeline.timeout)}
        </SummaryItem>
        <SummaryItem label="Updated">
          <DateTime
            value={pipeline.updatedAt}
            variant="both"
            style="datetime"
          />
        </SummaryItem>
      </SummaryGrid>

      <PipelineFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        editPipelineId={pipeline.id}
        domainIntegrations={domainIntegrations}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <PipelineAvailableAgents
          pipelineId={pipeline.id}
          agents={agents}
          existingStepAgentKeys={existingStepAgentKeys}
        />
        <PipelineStepsColumn
          pipelineId={pipeline.id}
          steps={pipeline.steps}
          agentDescriptions={agents}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          configsByAgentKey={configsByAgentKey}
        />
        <PipelineColumnCard
          title="Selected step"
          description={selectedStepDescription}
          action={
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || selectedStep == null}
            >
              {saveLabel}
            </Button>
          }
        >
          <StepSaveFeedback saveError={saveError} saveWarnings={saveWarnings} />
          <PipelineStepEditorPanel
            selectedStep={selectedStep}
            stepInput={stepInput}
            onStepInputChange={setStepInput}
            configsForAgent={configsForSelectedAgent}
            stepAgentConfigId={stepAgentConfigId}
            onStepAgentConfigIdChange={setStepAgentConfigId}
            allContracts={allContracts}
            stepAgentContractId={stepAgentContractId}
            onStepAgentContractIdChange={setStepAgentContractId}
            disabled={saving}
            loadVariablePickerPage={loadVariablePickerPage}
            loadExpansionPickerPage={loadExpansionPickerPage}
          />
        </PipelineColumnCard>
      </div>

      <section>{executionsSection}</section>
    </div>
  );
};
