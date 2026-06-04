"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useFormAction } from "@/app/dashboard/agent-contracts/actions/update/.generated/use-form-action";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

import type { AgentContractRow } from "./agent-contract-row-actions";

const initialFormState = {
  name: "",
  description: "",
  brief: "",
  version: "",
};

export const useEditContractModalState = (
  contract: AgentContractRow | null,
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
    if (contract && open) {
      setFormState({
        name: contract.name,
        description: contract.description ?? "",
        brief: contract.brief,
        version: contract.version,
      });
    }
  }, [contract, open]);

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
