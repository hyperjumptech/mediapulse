"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useFormAction } from "@/app/dashboard/agent-configs/actions/create/.generated/use-form-action";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

import type { AgentConfigRow } from "./agent-config-row-actions";

const emptyForm = {
  name: "",
  description: "",
  agentKey: "",
  config: {} as Record<string, unknown>,
};

/**
 * Encapsulates open/form state, form action, and close-on-success for add config modal.
 */
export const useAddConfigModalState = (
  controlledOpen?: boolean,
  onOpenChange?: (open: boolean) => void,
  initialData?: AgentConfigRow | null,
) => {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const { FormWithAction, state, pending } = useFormAction();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useMemo(
    () => (isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen),
    [isControlled, onOpenChange],
  );

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  useEffect(() => {
    if (open && initialData) {
      setFormState({
        name: `Copy of ${initialData.name}`,
        description: initialData.description ?? "",
        agentKey: `${initialData.agentId}@${initialData.agentVersion}`,
        config:
          typeof initialData.config === "object" && initialData.config !== null
            ? { ...(initialData.config as Record<string, unknown>) }
            : {},
      });
    } else if (open && !initialData) {
      setFormState(emptyForm);
    }
  }, [open, initialData]);

  useCloseOnSuccessfulSubmit({
    open,
    pending,
    state,
    isSuccess: (nextState) =>
      Boolean(
        nextState && nextState.status === true && nextState.data?.id != null,
      ),
    onSuccess: () => {
      setOpen(false);
      setFormState(emptyForm);
      router.refresh();
    },
  });

  return {
    open,
    setOpen,
    formState,
    setFormState,
    FormWithAction,
    pending,
    errorMessage,
  };
};
