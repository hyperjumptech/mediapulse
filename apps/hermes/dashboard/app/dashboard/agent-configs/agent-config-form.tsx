"use client";

import Link from "next/link";
import type React from "react";

import { Button } from "@workspace/ui/components/button";
import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";

import { FormErrorAlert } from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";

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
  const isIncomplete = !formState.name || !formState.agentKey;

  return (
    <FormWithAction className="flex max-w-3xl flex-col gap-6">
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
        onNameChange={(value) =>
          setFormState((previous) => ({ ...previous, name: value }))
        }
        onDescriptionChange={(value) =>
          setFormState((previous) => ({ ...previous, description: value }))
        }
        onAgentChange={(value) =>
          setFormState((previous) => ({ ...previous, agentKey: value }))
        }
        onConfigChange={(value) =>
          setFormState((previous) => ({ ...previous, config: value }))
        }
        pickerLoaders={pickerLoaders}
        disabled={pending}
      />
      {errorMessage ? <FormErrorAlert message={errorMessage} /> : null}
      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" asChild>
          <Link href="/dashboard/agent-configs">Cancel</Link>
        </Button>
        <SubmitButton
          pending={pending}
          pendingLabel={pendingLabel}
          disabled={isIncomplete}
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </FormWithAction>
  );
};
