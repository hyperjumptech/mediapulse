"use client";

import Link from "next/link";
import type React from "react";

import { Button } from "@workspace/ui/components/button";
import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";

import { AgentConfigFormFields } from "./agent-config-form-fields";

type AgentForDropdown = {
  id: string;
  agentId: string;
  agentVersion: string;
};

type FormState = {
  name: string;
  description: string;
  agentKey: string;
  config: Record<string, unknown>;
};

type AgentConfigFormProps = {
  FormWithAction: React.ComponentType<
    { children: React.ReactNode } & React.HTMLAttributes<HTMLFormElement>
  >;
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  pending: boolean;
  errorMessage: string | null;
  agents: AgentForDropdown[];
  pickerLoaders: VariableExpansionStringFieldLoaders;
  configId?: string;
  submitLabel: string;
  pendingLabel: string;
};

/**
 * Shared form body for add and edit agent config pages.
 * Renders hidden inputs, config fields, error message, and submit/cancel actions.
 */
export const AgentConfigForm = ({
  FormWithAction,
  formState,
  setFormState,
  pending,
  errorMessage,
  agents,
  pickerLoaders,
  configId,
  submitLabel,
  pendingLabel,
}: AgentConfigFormProps) => {
  const [agentId, agentVersion] = formState.agentKey
    ? formState.agentKey.split("@")
    : ["", ""];

  return (
    <FormWithAction className="flex flex-col gap-4">
      {configId ? (
        <input type="hidden" name="body.id" value={configId} readOnly />
      ) : null}
      <input type="hidden" name="body.name" value={formState.name} readOnly />
      <input
        type="hidden"
        name="body.description"
        value={formState.description}
        readOnly
      />
      <input type="hidden" name="body.agentId" value={agentId} readOnly />
      <input
        type="hidden"
        name="body.agentVersion"
        value={agentVersion}
        readOnly
      />
      <input
        type="hidden"
        name="body.config"
        value={JSON.stringify(formState.config)}
        readOnly
      />
      <AgentConfigFormFields
        name={formState.name}
        description={formState.description}
        agentKey={formState.agentKey}
        config={formState.config}
        agents={agents}
        onNameChange={(v) => setFormState((s) => ({ ...s, name: v }))}
        onDescriptionChange={(v) =>
          setFormState((s) => ({ ...s, description: v }))
        }
        onAgentChange={(v) => setFormState((s) => ({ ...s, agentKey: v }))}
        onConfigChange={(v) => setFormState((s) => ({ ...s, config: v }))}
        pickerLoaders={pickerLoaders}
        disabled={pending}
      />
      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/agent-configs">Cancel</Link>
        </Button>
        <Button
          type="submit"
          disabled={pending || !formState.name || !formState.agentKey}
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </FormWithAction>
  );
};
