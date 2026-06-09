"use client";

import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";

import { AgentConfigForm } from "../agent-config-form";
import { useAddConfigPageForm } from "./use-add-config-page-form";

type AgentForDropdown = {
  id: string;
  agentId: string;
  agentVersion: string;
};

type InitialData = {
  name: string;
  description: string;
  agentKey: string;
  config: Record<string, unknown>;
};

type AddConfigPageClientProps = {
  agents: AgentForDropdown[];
  pickerLoaders: VariableExpansionStringFieldLoaders;
  initialData?: InitialData | null;
};

/**
 * Client wrapper for the add config page. Delegates state and redirect logic to useAddConfigPageForm.
 */
export const AddConfigPageClient = ({
  agents,
  pickerLoaders,
  initialData,
}: AddConfigPageClientProps) => {
  const { formState, setFormState, FormWithAction, pending, errorMessage } =
    useAddConfigPageForm(initialData);

  return (
    <AgentConfigForm
      FormWithAction={FormWithAction}
      formState={formState}
      setFormState={setFormState}
      pending={pending}
      errorMessage={errorMessage}
      agents={agents}
      pickerLoaders={pickerLoaders}
      submitLabel={initialData ? "Create copy" : "Create config"}
      pendingLabel="Creating…"
    />
  );
};
