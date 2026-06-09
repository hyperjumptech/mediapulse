"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";

import { useFormAction } from "@/app/dashboard/agent-configs/actions/create/.generated/use-form-action";
import { AgentConfigForm } from "../agent-config-form";

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

const emptyForm = {
  name: "",
  description: "",
  agentKey: "",
  config: {} as Record<string, unknown>,
};

/**
 * Client wrapper for the add config page. Manages form state and redirects on success.
 */
export const AddConfigPageClient = ({
  agents,
  pickerLoaders,
  initialData,
}: AddConfigPageClientProps) => {
  const router = useRouter();
  const [formState, setFormState] = useState(initialData ?? emptyForm);
  const { FormWithAction, state, pending } = useFormAction();
  const wasPendingRef = useRef(false);

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  useEffect(() => {
    if (
      wasPendingRef.current &&
      !pending &&
      state?.status === true &&
      (state as { data?: { id?: unknown } }).data?.id != null
    ) {
      router.push("/dashboard/agent-configs");
    }
    wasPendingRef.current = pending;
  }, [pending, state, router]);

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
