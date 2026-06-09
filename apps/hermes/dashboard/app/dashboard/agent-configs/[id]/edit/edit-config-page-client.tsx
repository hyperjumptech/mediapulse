"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";

import { useFormAction } from "@/app/dashboard/agent-configs/actions/update/.generated/use-form-action";
import { AgentConfigForm } from "../../agent-config-form";

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
 * Client wrapper for the edit config page. Manages form state and redirects on success.
 */
export const EditConfigPageClient = ({
  config,
  agents,
  pickerLoaders,
}: EditConfigPageClientProps) => {
  const router = useRouter();
  const [formState, setFormState] = useState({
    name: config.name,
    description: config.description ?? "",
    agentKey: `${config.agentId}@${config.agentVersion}`,
    config:
      typeof config.config === "object" && config.config !== null
        ? { ...(config.config as Record<string, unknown>) }
        : {},
  });
  const { FormWithAction, state, pending } = useFormAction();
  const wasPendingRef = useRef(false);

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  useEffect(() => {
    if (wasPendingRef.current && !pending && state?.status === true) {
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
      configId={config.id}
      submitLabel="Save changes"
      pendingLabel="Saving…"
    />
  );
};
