"use client";

import Link from "next/link";
import { useMemo } from "react";

import { SchemaForm } from "@workspace/json-schema-form";
import type {
  LoadExpansionsPageResult,
  LoadPageArgs,
  LoadVariablesPageResult,
} from "@workspace/variable-expansion-picker";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Spinner } from "@workspace/ui/components/spinner";
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

const withDescriptionSuffix = (label: string, description: string | null) =>
  description ? `${label} — ${description}` : label;

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

const StepIdentity = ({ step }: { step: Step }) => (
  <p className="flex min-w-0 items-center gap-2 text-sm">
    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
      Step {step.order + 1}
    </span>
    <span className="truncate font-mono font-medium text-foreground">
      {step.agentId}@{step.agentVersion}
    </span>
  </p>
);

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
      <p className="text-sm text-muted-foreground">
        Select a step in the pipeline to edit its input and config.
      </p>
    );
  }

  if (schemaLoading) {
    return (
      <div className="flex flex-col gap-4">
        <StepIdentity step={selectedStep} />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          Loading schemas…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StepIdentity step={selectedStep} />
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
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
            <Field className="max-w-md">
              <FieldLabel htmlFor="step-agent-config-picker">
                Agent config *
              </FieldLabel>
              <NativeSelect
                id="step-agent-config-picker"
                value={stepAgentConfigId}
                onChange={(event) =>
                  onStepAgentConfigIdChange(event.target.value)
                }
                disabled={disabled}
                aria-label="Choose a saved agent config"
              >
                <NativeSelectOption value="">None</NativeSelectOption>
                {configsForAgent.map((config) => (
                  <NativeSelectOption key={config.id} value={config.id}>
                    {withDescriptionSuffix(config.name, config.description)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </TabsContent>
        <TabsContent value="contract" className="mt-4">
          <Field className="max-w-md">
            <FieldLabel htmlFor="step-agent-contract-picker">
              Agent contract *
            </FieldLabel>
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
              <NativeSelect
                id="step-agent-contract-picker"
                value={stepAgentContractId}
                onChange={(event) =>
                  onStepAgentContractIdChange(event.target.value)
                }
                disabled={disabled}
                aria-label="Choose an agent contract"
              >
                <NativeSelectOption value="">None</NativeSelectOption>
                {allContracts.map((contract) => (
                  <NativeSelectOption key={contract.id} value={contract.id}>
                    {withDescriptionSuffix(
                      `${contract.name} v${contract.version}`,
                      contract.description,
                    )}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </Field>
        </TabsContent>
      </Tabs>
    </div>
  );
};
