"use client";

import { SchemaForm } from "@workspace/json-schema-form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

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
  stepInput: Record<string, unknown>;
  stepConfig: Record<string, unknown>;
  onStepInputChange: (value: Record<string, unknown>) => void;
  onStepConfigChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
};

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
  const { schemas, schemaLoading, activeTab, setActiveTab } =
    useStepEditorPanelState(selectedStep);

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
