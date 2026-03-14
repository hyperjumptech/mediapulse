"use client";

import { useEffect, useState } from "react";

import { SchemaForm } from "@workspace/json-schema-form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

type Step = {
  id: string;
  order: number;
  agentId: string;
  agentVersion: string;
  agentConfigId?: string | null;
  input?: unknown;
  config?: unknown;
};

export type PipelineStepEditorPanelProps = {
  selectedStep: Step | null;
  stepInput: Record<string, unknown>;
  stepConfig: Record<string, unknown>;
  onStepInputChange: (value: Record<string, unknown>) => void;
  onStepConfigChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
};

const fetchAgentSchemas = async (
  agentId: string,
  agentVersion: string,
): Promise<{ inputSchema: unknown; configSchema: unknown } | null> => {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/${encodeURIComponent(agentVersion)}/schemas`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    inputSchema?: unknown;
    configSchema?: unknown;
  };
  return {
    inputSchema: data.inputSchema ?? null,
    configSchema: data.configSchema ?? null,
  };
};

const isObjectSchemaWithProperties = (schema: unknown): boolean =>
  schema != null &&
  typeof schema === "object" &&
  !Array.isArray(schema) &&
  (schema as { type?: string }).type === "object" &&
  (schema as { properties?: unknown }).properties != null;

/**
 * Renders the selected agent's input and config forms from its schemas.
 * Third column only; pipeline name/description and Save live above the layout.
 */
export const PipelineStepEditorPanel = ({
  selectedStep,
  stepInput,
  stepConfig,
  onStepInputChange,
  onStepConfigChange,
  disabled = false,
}: PipelineStepEditorPanelProps) => {
  const [schemas, setSchemas] = useState<{
    inputSchema: Record<string, unknown> | null;
    configSchema: Record<string, unknown> | null;
  }>({ inputSchema: null, configSchema: null });
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"input" | "config">("input");
  const [lastStepId, setLastStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedStep) {
      setLastStepId(null);
      return;
    }
    if (selectedStep.id !== lastStepId) {
      setLastStepId(selectedStep.id);
      setActiveTab("input");
    }
  }, [selectedStep, lastStepId]);

  useEffect(() => {
    if (!selectedStep) {
      setSchemas({ inputSchema: null, configSchema: null });
      return;
    }
    setSchemaLoading(true);
    fetchAgentSchemas(selectedStep.agentId, selectedStep.agentVersion)
      .then((result) => {
        if (!result) {
          setSchemas({ inputSchema: null, configSchema: null });
          return;
        }
        const inputSchema =
          isObjectSchemaWithProperties(result.inputSchema) &&
          typeof result.inputSchema === "object"
            ? (result.inputSchema as Record<string, unknown>)
            : null;
        const configSchema =
          isObjectSchemaWithProperties(result.configSchema) &&
          typeof result.configSchema === "object"
            ? (result.configSchema as Record<string, unknown>)
            : null;
        setSchemas({ inputSchema, configSchema });
      })
      .finally(() => setSchemaLoading(false));
  }, [selectedStep]);

  if (!selectedStep) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">
          Agent input & config
        </h3>
        <p className="text-sm text-muted-foreground">
          Select a step in the pipeline to edit its input and config.
        </p>
      </div>
    );
  }

  if (schemaLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">
          Agent input & config
        </h3>
        <p className="text-sm text-muted-foreground">Loading schemas…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-foreground">
        Agent input & config
      </h3>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "input" | "config")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>
        <TabsContent value="input" className="mt-4">
          {schemas.inputSchema ? (
            <SchemaForm
              schema={schemas.inputSchema}
              value={stepInput}
              onChange={onStepInputChange}
              disabled={disabled}
              seedRequiredDefaults={true}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              No input schema for this agent.
            </p>
          )}
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          {schemas.configSchema ? (
            <SchemaForm
              schema={schemas.configSchema}
              value={stepConfig}
              onChange={onStepConfigChange}
              disabled={disabled}
              seedRequiredDefaults={true}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              No config schema for this agent.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
