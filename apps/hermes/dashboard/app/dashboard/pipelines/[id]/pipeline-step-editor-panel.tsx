"use client";

import Link from "next/link";
import { useMemo } from "react";

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
import type { AgentContractSummary } from "@/lib/agent-contracts";

import { useStepEditorPanelState } from "./use-step-editor-panel-state";

type Step = {
  id: string;
  order: number;
  agentId: string;
  agentVersion: string;
  agentConfigId?: string | null;
  agentContractId?: string | null;
  input?: unknown;
  config?: unknown;
};

export type PipelineStepEditorPanelProps = {
  selectedStep: Step | null;
  stepInput: Record<string, unknown>;
  onStepInputChange: (value: Record<string, unknown>) => void;
  /** Agent configs for the selected step's agent (for Config tab picker). */
  configsForAgent: AgentConfigSummary[];
  stepAgentConfigId: string;
  onStepAgentConfigIdChange: (id: string) => void;
  /** All agent contracts for the contract picker. */
  allContracts: AgentContractSummary[];
  stepAgentContractId: string;
  onStepAgentContractIdChange: (id: string) => void;
  disabled?: boolean;
  /** Server action: paginated variables for the insert picker. */
  loadVariablePickerPage: (
    args: LoadPageArgs,
  ) => Promise<LoadVariablesPageResult>;
  /** Server action: paginated expansions for the insert picker. */
  loadExpansionPickerPage: (
    args: LoadPageArgs,
  ) => Promise<LoadExpansionsPageResult>;
};

/**
 * Renders the selected agent's input form and config picker (saved agent configs only).
 * Third column only; pipeline name/description and Save live above the layout.
 */
export const PipelineStepEditorPanel = ({
  selectedStep,
  stepInput,
  onStepInputChange,
  configsForAgent = [],
  stepAgentConfigId,
  onStepAgentConfigIdChange,
  allContracts = [],
  stepAgentContractId,
  onStepAgentContractIdChange,
  disabled = false,
  loadVariablePickerPage,
  loadExpansionPickerPage,
}: PipelineStepEditorPanelProps) => {
  const { schemas, schemaLoading, activeTab, setActiveTab } =
    useStepEditorPanelState(selectedStep);

  type TabValue = "input" | "config" | "contract";
  const stringFieldComponent = useMemo(
    () =>
      createVariableExpansionStringField({
        loadVariablesPage: loadVariablePickerPage,
        loadExpansionsPage: loadExpansionPickerPage,
      }),
    [loadExpansionPickerPage, loadVariablePickerPage],
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
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
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
        <TabsContent value="contract" className="mt-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="step-agent-contract-picker">Agent contract</Label>
              <p className="text-xs text-muted-foreground">
                Attaches a product brief to this step so the agent knows what
                the end result looks like.
              </p>
              {allContracts.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    No agent contracts yet. Create one first.
                  </p>
                  <Link
                    href="/dashboard/agent-contracts"
                    className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
                  >
                    Go to Agent contracts
                  </Link>
                </div>
              ) : (
                <select
                  id="step-agent-contract-picker"
                  className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={stepAgentContractId}
                  onChange={(e) => onStepAgentContractIdChange(e.target.value)}
                  disabled={disabled}
                  aria-label="Choose an agent contract"
                >
                  <option value="">None</option>
                  {allContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} v{c.version}
                      {c.description ? ` — ${c.description}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
