"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";

import { SchemaForm } from "@workspace/json-schema-form";
import type {
  LoadExpansionsPageResult,
  LoadPageArgs,
  LoadVariablesPageResult,
} from "@workspace/variable-expansion-picker";
import { Label } from "@workspace/ui/components/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { createVariableExpansionStringField } from "@workspace/variable-expansion-picker";
import type { AgentConfigSummary } from "@/lib/agent-configs";

import { useStepEditorPanelState } from "./use-step-editor-panel-state";

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
  /** Must match the pipeline’s domain integration (DSE templates are scoped per integration). */
  domainIntegrationKey: string;
  stepInput: Record<string, unknown>;
  onStepInputChange: (value: Record<string, unknown>) => void;
  /** Agent configs for the selected step's agent (for Config tab picker). */
  configsForAgent: AgentConfigSummary[];
  stepAgentConfigId: string;
  onStepAgentConfigIdChange: (id: string) => void;
  disabled?: boolean;
  /** Server action: paginated variables for the insert picker. */
  loadVariablePickerPage: (
    args: LoadPageArgs,
  ) => Promise<LoadVariablesPageResult>;
  /** Server action: paginated expansions for the insert picker. */
  loadExpansionPickerPage: (
    args: LoadPageArgs,
  ) => Promise<LoadExpansionsPageResult>;
  /** Server action: resolves expansion id to display name for persisted dse tokens. */
  loadExpansionNameById: (raw: unknown) => Promise<string | null>;
  /** Prefetched DSE template id → display name for this pipeline (RSC). */
  pipelineExpansionNames: Readonly<Record<string, string>>;
};

/**
 * Renders the selected agent's input form and config picker (saved agent configs only).
 * Third column only; pipeline name/description and Save live above the layout.
 */
export const PipelineStepEditorPanel = ({
  selectedStep,
  domainIntegrationKey,
  stepInput,
  onStepInputChange,
  configsForAgent = [],
  stepAgentConfigId,
  onStepAgentConfigIdChange,
  disabled = false,
  loadVariablePickerPage,
  loadExpansionPickerPage,
  loadExpansionNameById,
  pipelineExpansionNames,
}: PipelineStepEditorPanelProps) => {
  const { schemas, schemaLoading, activeTab, setActiveTab } =
    useStepEditorPanelState(selectedStep);
  const resolveExpansionNameById = useCallback(
    (id: string) =>
      loadExpansionNameById({
        integrationKey: domainIntegrationKey,
        id,
      }),
    [domainIntegrationKey, loadExpansionNameById],
  );
  const stringFieldComponent = useMemo(
    () =>
      createVariableExpansionStringField({
        loadVariablesPage: loadVariablePickerPage,
        loadExpansionsPage: loadExpansionPickerPage,
        resolveExpansionNameById,
        initialExpansionNames: pipelineExpansionNames,
      }),
    [
      loadExpansionPickerPage,
      loadVariablePickerPage,
      pipelineExpansionNames,
      resolveExpansionNameById,
    ],
  );

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
              components={{ StringField: stringFieldComponent }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              No input schema for this agent.
            </p>
          )}
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          {configsForAgent.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                No agent configs for this agent. Create one first.
              </p>
              <Link
                href="/dashboard/agent-configs"
                className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
              >
                Go to Agent configs
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="step-agent-config-picker">Agent config</Label>
                <select
                  id="step-agent-config-picker"
                  className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={stepAgentConfigId}
                  onChange={(e) => onStepAgentConfigIdChange(e.target.value)}
                  disabled={disabled}
                  aria-label="Choose a saved agent config"
                >
                  <option value="">None</option>
                  {configsForAgent.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.description ? ` — ${c.description}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
