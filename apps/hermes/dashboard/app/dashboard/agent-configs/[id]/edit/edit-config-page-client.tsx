"use client";

import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";

import { AgentConfigForm } from "../../agent-config-form";
import { useEditConfigPageForm } from "./use-edit-config-page-form";

type AgentForDropdown = {
  id: string;
  agentId: string;
  agentVersion: string;
};

type Config = {
  id: string;
  name: string;
  description: string | null;
  agentId: string;
  agentVersion: string;
  config: unknown;
};

type EditConfigPageClientProps = {
  config: Config;
  agents: AgentForDropdown[];
  pickerLoaders: VariableExpansionStringFieldLoaders;
};

/**
 * Client wrapper for the edit config page. Delegates state and redirect logic to useEditConfigPageForm.
 */
export const EditConfigPageClient = ({
  config,
  agents,
  pickerLoaders,
}: EditConfigPageClientProps) => {
  const { formState, setFormState, FormWithAction, pending, errorMessage } =
    useEditConfigPageForm(config);

  return (
    <AgentConfigForm
      FormWithAction={FormWithAction}
      formState={formState}
      setFormState={setFormState}
      pending={pending}
      errorMessage={errorMessage}
      agents={agents}
      pickerLoaders={pickerLoaders}
      configId={config.id}
      submitLabel="Save changes"
      pendingLabel="Saving…"
    />
  );
};
