"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";

import { useFormAction as useRemoveStepFormAction } from "@/app/dashboard/pipelines/actions/remove-step/.generated/use-form-action";
import { useFormAction as useUpdateStepFormAction } from "@/app/dashboard/pipelines/actions/update-step/.generated/use-form-action";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";

import type { AgentConfigSummary } from "@/lib/agent-configs";

type Step = {
  id: string;
  order: number;
  agentId: string;
  agentVersion: string;
  agentConfigId?: string | null;
  input?: unknown;
  config?: unknown;
};

type Agent = {
  id: string;
  agentId: string;
  agentVersion: string;
  description: string | null;
};

const withDescriptionSuffix = (label: string, description: string | null) =>
  description ? `${label} — ${description}` : label;

const toStepInputJson = (input: unknown): string => {
  const isPlainObject =
    input != null && typeof input === "object" && !Array.isArray(input);

  return JSON.stringify(isPlainObject ? input : {});
};

/**
 * Renders the list of pipeline steps with Remove button per step.
 */
export const StepList = ({
  pipelineId,
  steps,
  agentDescriptions,
  configsByAgentKey,
}: {
  pipelineId: string;
  steps: Step[];
  agentDescriptions: Agent[];
  configsByAgentKey: Record<string, AgentConfigSummary[]>;
}) => {
  const agentByKey = useMemo(() => {
    const agentsByKey = new Map<string, Agent>();
    for (const agent of agentDescriptions) {
      agentsByKey.set(`${agent.agentId}@${agent.agentVersion}`, agent);
    }

    return agentsByKey;
  }, [agentDescriptions]);

  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No steps yet. Add an agent from the list below.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {steps.map((step) => (
        <StepRow
          key={step.id}
          pipelineId={pipelineId}
          step={step}
          description={
            agentByKey.get(`${step.agentId}@${step.agentVersion}`)
              ?.description ?? null
          }
          agents={agentDescriptions}
          configsByAgentKey={configsByAgentKey}
        />
      ))}
    </ul>
  );
};

/**
 * Encapsulates step row state: edit mode, form fields, and remove/update form actions.
 */
const useStepRowState = (
  step: Step,
  pipelineId: string,
  configsByAgentKey: Record<string, AgentConfigSummary[]>,
) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editAgentKey, setEditAgentKey] = useState(
    `${step.agentId}@${step.agentVersion}`,
  );
  const [editSavedConfigId, setEditSavedConfigId] = useState<string | "">(
    step.agentConfigId ?? "",
  );

  const { FormWithAction: RemoveForm, pending: removePending } =
    useRemoveStepFormAction();
  const {
    FormWithAction: UpdateForm,
    state: updateState,
    pending: updatePending,
  } = useUpdateStepFormAction();

  useEffect(() => {
    if (updateState && updateState.status === true) {
      setIsEditing(false);
    }
  }, [updateState]);

  const updateErrorMessage =
    updateState && updateState.status === false ? updateState.message : null;

  const savedConfigs = editAgentKey
    ? (configsByAgentKey[editAgentKey] ?? [])
    : [];

  return {
    isEditing,
    setIsEditing,
    editAgentKey,
    setEditAgentKey,
    editSavedConfigId,
    setEditSavedConfigId,
    RemoveForm,
    UpdateForm,
    removePending,
    updatePending,
    updateErrorMessage,
    savedConfigs,
  };
};

/**
 * Single step row: order, agent id/version, description, Edit and Remove. Edit form persists step change to DB.
 */
const StepRow = ({
  pipelineId,
  step,
  description,
  agents,
  configsByAgentKey,
}: {
  pipelineId: string;
  step: Step;
  description: string | null;
  agents: Agent[];
  configsByAgentKey: Record<string, AgentConfigSummary[]>;
}) => {
  const {
    isEditing,
    setIsEditing,
    editAgentKey,
    setEditAgentKey,
    editSavedConfigId,
    setEditSavedConfigId,
    RemoveForm,
    UpdateForm,
    removePending,
    updatePending,
    updateErrorMessage,
    savedConfigs,
  } = useStepRowState(step, pipelineId, configsByAgentKey);

  if (isEditing) {
    const [agentId, agentVersion] = editAgentKey.split("@");
    const stepInputJson = toStepInputJson(step.input);

    return (
      <li className="flex gap-3 rounded-md border p-3">
        <span className="w-6 pt-0.5 font-mono text-sm text-muted-foreground">
          {step.order + 1}.
        </span>
        <UpdateForm className="flex min-w-0 flex-1 flex-col gap-4">
          <input
            type="hidden"
            name="body.pipelineId"
            value={pipelineId}
            readOnly
          />
          <input type="hidden" name="body.stepId" value={step.id} readOnly />
          <input
            type="hidden"
            name="body.agentId"
            value={agentId ?? ""}
            readOnly
          />
          <input
            type="hidden"
            name="body.agentVersion"
            value={agentVersion ?? ""}
            readOnly
          />
          <input
            type="hidden"
            name="body.agentConfigId"
            value={editSavedConfigId}
            readOnly
          />
          <input
            type="hidden"
            name="body.input"
            value={stepInputJson}
            readOnly
          />
          <input type="hidden" name="body.config" value="{}" readOnly />
          <Field className="max-w-md">
            <FieldLabel htmlFor={`step-agent-${step.id}`}>Agent</FieldLabel>
            <NativeSelect
              id={`step-agent-${step.id}`}
              value={editAgentKey}
              onChange={(event) => {
                setEditAgentKey(event.target.value);
                setEditSavedConfigId("");
              }}
              disabled={updatePending}
            >
              {agents.map((agent) => (
                <NativeSelectOption
                  key={agent.id}
                  value={`${agent.agentId}@${agent.agentVersion}`}
                >
                  {withDescriptionSuffix(
                    `${agent.agentId}@${agent.agentVersion}`,
                    agent.description,
                  )}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="max-w-md">
            <FieldLabel htmlFor={`step-saved-config-${step.id}`}>
              Agent config
            </FieldLabel>
            <NativeSelect
              id={`step-saved-config-${step.id}`}
              value={editSavedConfigId}
              onChange={(event) => setEditSavedConfigId(event.target.value)}
              disabled={updatePending}
              aria-label="Choose a saved agent config"
            >
              <NativeSelectOption value="">None</NativeSelectOption>
              {savedConfigs.map((config) => (
                <NativeSelectOption key={config.id} value={config.id}>
                  {withDescriptionSuffix(config.name, config.description)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {savedConfigs.length === 0 ? (
              <FieldDescription>
                No agent configs for this agent. Create one in Agent configs
                first.
              </FieldDescription>
            ) : null}
          </Field>
          {updateErrorMessage ? (
            <FormErrorAlert message={updateErrorMessage} />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={updatePending}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <SubmitButton
              size="sm"
              pending={updatePending}
              pendingLabel="Saving…"
            >
              Save
            </SubmitButton>
          </div>
        </UpdateForm>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 rounded-md border p-3">
      <span className="w-6 font-mono text-sm text-muted-foreground">
        {step.order + 1}.
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-medium">
          {step.agentId}@{step.agentVersion}
        </span>
        {description ? (
          <span className="ml-2 text-sm text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          aria-label={`Edit step ${step.agentId}@${step.agentVersion}`}
        >
          Edit
        </Button>
        <RemoveForm className="inline">
          <input
            type="hidden"
            name="body.pipelineId"
            value={pipelineId}
            readOnly
          />
          <input type="hidden" name="body.stepId" value={step.id} readOnly />
          <SubmitButton
            variant="destructive"
            size="sm"
            pending={removePending}
            pendingLabel="Removing…"
            aria-label={`Remove step ${step.agentId}@${step.agentVersion}`}
          >
            Remove
          </SubmitButton>
        </RemoveForm>
      </div>
    </li>
  );
};
