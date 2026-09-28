"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Textarea } from "@workspace/ui/components/textarea";

import { useFormAction } from "@/app/dashboard/pipelines/actions/add-step/.generated/use-form-action";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";
import type { AgentConfigSummary } from "@/lib/agent-configs";

type Agent = {
  id: string;
  agentId: string;
  agentVersion: string;
  description: string | null;
};

const withDescriptionSuffix = (label: string, description: string | null) =>
  description ? `${label} — ${description}` : label;

/**
 * Encapsulates add-step form state: selection, config, form action, and reset-on-success.
 */
const useAddStepFormState = (
  agents: Agent[],
  existingStepAgentKeys: string[],
  configsByAgentKey: Record<string, AgentConfigSummary[]>,
) => {
  const { FormWithAction, state, pending } = useFormAction();
  const [selected, setSelected] = useState<{
    agentId: string;
    agentVersion: string;
  } | null>(null);
  const [savedConfigId, setSavedConfigId] = useState<string | "">("");
  const [customConfigJson, setCustomConfigJson] = useState("{}");

  const availableAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          !existingStepAgentKeys.includes(
            `${agent.agentId}@${agent.agentVersion}`,
          ),
      ),
    [agents, existingStepAgentKeys],
  );

  const agentKey = selected
    ? `${selected.agentId}@${selected.agentVersion}`
    : "";
  const savedConfigs = agentKey ? (configsByAgentKey[agentKey] ?? []) : [];
  const useSavedConfig = savedConfigId !== "";

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message;
    return null;
  }, [state]);

  useEffect(() => {
    if (state && state.status === true) {
      setSelected(null);
      setSavedConfigId("");
      setCustomConfigJson("{}");
    }
  }, [state]);

  useEffect(() => {
    setSavedConfigId("");
  }, [agentKey]);

  const selectAgentKey = useCallback((value: string) => {
    if (!value) {
      setSelected(null);

      return;
    }
    const [agentId, agentVersion] = value.split("@");
    if (agentId && agentVersion) {
      setSelected({ agentId, agentVersion });
    }
  }, []);

  return {
    FormWithAction,
    pending,
    errorMessage,
    selected,
    selectAgentKey,
    savedConfigId,
    setSavedConfigId,
    customConfigJson,
    setCustomConfigJson,
    availableAgents,
    agentKey,
    savedConfigs,
    useSavedConfig,
  };
};

/**
 * Add step form: select agent, optional saved config or custom JSON config; submit to add-step.
 */
export const AddStepForm = ({
  pipelineId,
  agents,
  existingStepAgentKeys,
  configsByAgentKey,
}: {
  pipelineId: string;
  agents: Agent[];
  existingStepAgentKeys: string[];
  configsByAgentKey: Record<string, AgentConfigSummary[]>;
}) => {
  const {
    FormWithAction,
    pending,
    errorMessage,
    selected,
    selectAgentKey,
    savedConfigId,
    setSavedConfigId,
    customConfigJson,
    setCustomConfigJson,
    availableAgents,
    agentKey,
    savedConfigs,
    useSavedConfig,
  } = useAddStepFormState(agents, existingStepAgentKeys, configsByAgentKey);

  return (
    <FormWithAction className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="body.pipelineId" value={pipelineId} readOnly />
      <input
        type="hidden"
        name="body.agentId"
        value={selected?.agentId ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="body.agentVersion"
        value={selected?.agentVersion ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="body.agentConfigId"
        value={useSavedConfig ? savedConfigId : ""}
        readOnly
      />
      <input
        type="hidden"
        name="body.config"
        value={useSavedConfig ? "{}" : customConfigJson}
        readOnly
      />
      <div className="flex flex-wrap items-end gap-2">
        <Field className="w-full max-w-sm">
          <FieldLabel htmlFor="add-step-agent">Add agent</FieldLabel>
          <NativeSelect
            id="add-step-agent"
            value={agentKey}
            onChange={(event) => selectAgentKey(event.target.value)}
            disabled={pending}
          >
            <NativeSelectOption value="">Select an agent…</NativeSelectOption>
            {availableAgents.map((agent) => (
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
        <SubmitButton
          variant="secondary"
          pending={pending}
          pendingLabel="Adding…"
          disabled={!selected}
        >
          Add step
        </SubmitButton>
      </div>
      {selected && savedConfigs.length > 0 ? (
        <Field className="max-w-md">
          <FieldLabel htmlFor="add-step-saved-config">
            Saved config (optional)
          </FieldLabel>
          <NativeSelect
            id="add-step-saved-config"
            value={savedConfigId}
            onChange={(event) => setSavedConfigId(event.target.value)}
            disabled={pending}
          >
            <NativeSelectOption value="">
              None (use custom below)
            </NativeSelectOption>
            {savedConfigs.map((config) => (
              <NativeSelectOption key={config.id} value={config.id}>
                {withDescriptionSuffix(config.name, config.description)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      {selected && !useSavedConfig ? (
        <Field>
          <FieldLabel htmlFor="add-step-config">
            Config (JSON, optional)
          </FieldLabel>
          <Textarea
            id="add-step-config"
            value={customConfigJson}
            onChange={(event) => setCustomConfigJson(event.target.value)}
            rows={3}
            disabled={pending}
            className="font-mono"
            placeholder="{}"
          />
        </Field>
      ) : null}
      {availableAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All registered agents are already in this pipeline.
        </p>
      ) : null}
      {errorMessage ? <FormErrorAlert message={errorMessage} /> : null}
    </FormWithAction>
  );
};
