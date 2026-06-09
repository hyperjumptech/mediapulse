"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useFormAction } from "@/app/dashboard/agent-configs/actions/create/.generated/use-form-action";

type InitialData = {
  name: string;
  description: string;
  agentKey: string;
  config: Record<string, unknown>;
};

const emptyForm = {
  name: "",
  description: "",
  agentKey: "",
  config: {} as Record<string, unknown>,
};

/**
 * Encapsulates form state, create action, error message, and redirect-on-success for the add config page.
 */
export const useAddConfigPageForm = (initialData?: InitialData | null) => {
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

  return { formState, setFormState, FormWithAction, pending, errorMessage };
};
