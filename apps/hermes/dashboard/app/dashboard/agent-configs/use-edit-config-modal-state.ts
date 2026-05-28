"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useFormAction } from "@/app/dashboard/agent-configs/actions/update/.generated/use-form-action";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

import type { AgentConfigRow } from "./agent-config-row-actions";

const initialFormState = {
  name: "",
  description: "",
  agentKey: "",
  config: {} as Record<string, unknown>,
};

/**
 * Encapsulates form state synced from config, form action, and close-on-success for edit config modal.
 */
export const useEditConfigModalState = (
  config: AgentConfigRow | null,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) => {
  const router = useRouter();
  const [formState, setFormState] = useState(initialFormState);
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  useEffect(() => {
    if (config && open) {
      setFormState({
        name: config.name,
        description: config.description ?? "",
        agentKey: `${config.agentId}@${config.agentVersion}`,
        config:
          typeof config.config === "object" && config.config !== null
            ? { ...(config.config as Record<string, unknown>) }
            : {},
      });
    }
  }, [config, open]);

  useCloseOnSuccessfulSubmit({
    open,
    pending,
    state,
    isSuccess: (nextState) => Boolean(nextState && nextState.status === true),
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });

  return { formState, setFormState, FormWithAction, pending, errorMessage };
};
