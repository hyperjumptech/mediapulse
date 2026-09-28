"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Spinner } from "@workspace/ui/components/spinner";
import { SchemaForm, type JsonSchema } from "@workspace/json-schema-form";

import {
  createVariableExpansionStringField,
  type VariableExpansionStringFieldLoaders,
} from "@workspace/variable-expansion-picker";

type AgentForDropdown = {
  id: string;
  agentId: string;
  agentVersion: string;
};

type AgentConfigFormFieldsProps = {
  name: string;
  description: string;
  agentKey: string;
  config: Record<string, unknown>;
  agents: AgentForDropdown[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAgentChange: (agentKey: string) => void;
  onConfigChange: (value: Record<string, unknown>) => void;
  pickerLoaders: VariableExpansionStringFieldLoaders;
  disabled?: boolean;
  nameId?: string;
  descriptionId?: string;
  agentSelectId?: string;
};

const fetchConfigSchema = async (
  agentId: string,
  agentVersion: string,
): Promise<Record<string, unknown> | null> => {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/${encodeURIComponent(agentVersion)}/schemas`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { configSchema?: Record<string, unknown> };
  return data.configSchema ?? null;
};

/**
 * Fetches and holds config schema state for the selected agent.
 */
const useAgentConfigSchema = (agentId?: string, agentVersion?: string) => {
  const [configSchema, setConfigSchema] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  useEffect(() => {
    if (!agentId || !agentVersion) {
      setConfigSchema(null);
      return;
    }
    setSchemaLoading(true);
    fetchConfigSchema(agentId, agentVersion)
      .then(setConfigSchema)
      .finally(() => setSchemaLoading(false));
  }, [agentId, agentVersion]);

  const isObjectSchema = useMemo(
    () =>
      Boolean(
        configSchema &&
        typeof configSchema === "object" &&
        configSchema.type === "object" &&
        configSchema.properties != null,
      ),
    [configSchema],
  );

  return { configSchema, schemaLoading, isObjectSchema };
};

/**
 * Form fields for agent config: name, description, agent select, and SchemaForm for config.
 */
export const AgentConfigFormFields = ({
  name,
  description,
  agentKey,
  config,
  agents,
  onNameChange,
  onDescriptionChange,
  onAgentChange,
  onConfigChange,
  pickerLoaders,
  disabled = false,
  nameId = "agent-config-name",
  descriptionId = "agent-config-description",
  agentSelectId = "agent-config-agent",
}: AgentConfigFormFieldsProps) => {
  const [agentId, agentVersion] = agentKey
    ? agentKey.split("@")
    : [undefined, undefined];
  const { configSchema, schemaLoading, isObjectSchema } = useAgentConfigSchema(
    agentId,
    agentVersion,
  );
  const stringFieldComponent = useMemo(
    () => createVariableExpansionStringField(pickerLoaders),
    [pickerLoaders],
  );

  const handleAgentChange = useCallback(
    (nextAgentKey: string) => {
      onAgentChange(nextAgentKey);
      onConfigChange({});
    },
    [onAgentChange, onConfigChange],
  );

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Details</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={nameId}>Name</FieldLabel>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={disabled}
              placeholder="My config"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={descriptionId}>
              Description (optional)
            </FieldLabel>
            <Input
              id={descriptionId}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              disabled={disabled}
              placeholder="Brief description"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={agentSelectId}>Agent</FieldLabel>
            <NativeSelect
              id={agentSelectId}
              value={agentKey}
              onChange={(event) => handleAgentChange(event.target.value)}
              disabled={disabled}
            >
              <NativeSelectOption value="">Select an agent…</NativeSelectOption>
              {agents.map((agent) => (
                <NativeSelectOption
                  key={agent.id}
                  value={`${agent.agentId}@${agent.agentVersion}`}
                >
                  {agent.agentId}@{agent.agentVersion}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </FieldGroup>
      </FieldSet>
      {agentKey ? (
        <>
          <FieldSeparator />
          <FieldSet>
            <FieldLegend>Configuration</FieldLegend>
            <FieldDescription>
              Values saved with this preset for {agentKey}.
            </FieldDescription>
            {schemaLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner aria-hidden="true" />
                Loading schema…
              </p>
            ) : isObjectSchema ? (
              <SchemaForm
                schema={configSchema as JsonSchema}
                value={config}
                onChange={onConfigChange}
                disabled={disabled}
                components={{ StringField: stringFieldComponent }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This agent has no config schema. Config will be saved as empty.
              </p>
            )}
          </FieldSet>
        </>
      ) : null}
    </FieldGroup>
  );
};
