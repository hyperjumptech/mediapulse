"use client";

import Link from "next/link";

import { SchemaForm } from "@workspace/json-schema-form";
import { Label } from "@workspace/ui/components/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { createVariableExpansionStringField } from "@/components/variable-expansion-schema-string-field";
import type { AgentConfigSummary } from "@/lib/agent-configs";

import { useStepEditorPanelState } from "./use-step-editor-panel-state";

type Step = {
  id: string;
  order: number;
  agentId: string;
  agentVersion: string;
  agentConfigId?: string | null;
  registeredDatabaseId?: string | null;
  input?: unknown;
  config?: unknown;
};

export type VariableKeyOption = { key: string };

export type ExpansionTemplateOption = {
  id: string;
  name: string;
  expansionString: string;
};

export type RegisteredDatabaseOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type PipelineStepEditorPanelProps = {
  selectedStep: Step | null;
  stepInput: Record<string, unknown>;
  onStepInputChange: (value: Record<string, unknown>) => void;
  /** Agent configs for the selected step's agent (for Config tab picker). */
  configsForAgent: AgentConfigSummary[];
  stepAgentConfigId: string;
  onStepAgentConfigIdChange: (id: string) => void;
  registeredDatabases?: RegisteredDatabaseOption[];
  stepRegisteredDatabaseId: string;
  onStepRegisteredDatabaseIdChange: (id: string) => void;
  disabled?: boolean;
  /** Variable keys for the insert picker ({{key}}). */
  variableKeys?: VariableKeyOption[];
  /** Expansion templates for the insert picker. */
  expansionTemplates?: ExpansionTemplateOption[];
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
  registeredDatabases = [],
  stepRegisteredDatabaseId,
  onStepRegisteredDatabaseIdChange,
  disabled = false,
  variableKeys = [],
  expansionTemplates = [],
}: PipelineStepEditorPanelProps) => {
  const { schemas, schemaLoading, activeTab, setActiveTab } =
    useStepEditorPanelState(selectedStep);
  const stringFieldComponent = createVariableExpansionStringField(
    variableKeys,
    expansionTemplates,
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
              <div className="grid gap-2">
                <Label htmlFor="step-registered-database-picker">
                  Expansion database
                </Label>
                <select
                  id="step-registered-database-picker"
                  className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={stepRegisteredDatabaseId}
                  onChange={(e) =>
                    onStepRegisteredDatabaseIdChange(e.target.value)
                  }
                  disabled={disabled}
                  aria-label="Choose a registered expansion database"
                >
                  <option value="">Default</option>
                  {registeredDatabases.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.name}
                      {db.isDefault ? " (default)" : ""}
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
