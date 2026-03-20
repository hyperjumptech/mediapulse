"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { SchemaForm, type JsonSchema } from "@workspace/json-schema-form";
import { cn } from "@workspace/ui/lib/utils";

import { createVariableExpansionStringField } from "@/components/variable-expansion-schema-string-field";
import type {
  ExpansionOption,
  VariableOption,
} from "@/components/variable-expansion-input";

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
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onAgentChange: (agentKey: string) => void;
  onConfigChange: (v: Record<string, unknown>) => void;
  variableKeys?: VariableOption[];
  expansionTemplates?: ExpansionOption[];
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
  variableKeys = [],
  expansionTemplates = [],
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
    () => createVariableExpansionStringField(variableKeys, expansionTemplates),
    [variableKeys, expansionTemplates],
  );

  const handleAgentChange = useCallback(
    (v: string) => {
      onAgentChange(v);
      onConfigChange({});
    },
    [onAgentChange, onConfigChange],
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          placeholder="My config"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={descriptionId}>Description (optional)</Label>
        <Input
          id={descriptionId}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          placeholder="Brief description"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={agentSelectId}>Agent</Label>
        <select
          id={agentSelectId}
          value={agentKey}
          onChange={(e) => handleAgentChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          <option value="">Select an agent…</option>
          {agents.map((a) => (
            <option key={a.id} value={`${a.agentId}@${a.agentVersion}`}>
              {a.agentId}@{a.agentVersion}
            </option>
          ))}
        </select>
      </div>
      {schemaLoading ? (
        <p className="text-muted-foreground text-sm">Loading schema…</p>
      ) : isObjectSchema ? (
        <div className="grid gap-1.5">
          <Label>Config</Label>
          <SchemaForm
            schema={configSchema as JsonSchema}
            value={config}
            onChange={onConfigChange}
            disabled={disabled}
            components={{ StringField: stringFieldComponent }}
          />
        </div>
      ) : agentKey ? (
        <p className="text-muted-foreground text-sm">
          This agent has no config schema. Config will be saved as empty.
        </p>
      ) : null}
    </div>
  );
};
