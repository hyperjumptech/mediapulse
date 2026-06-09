"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useFormAction } from "@/app/dashboard/agent-configs/actions/update/.generated/use-form-action";

type Config = {
  id: string;
  name: string;
  description: string | null;
  agentId: string;
  agentVersion: string;
  config: unknown;
};

/**
 * Encapsulates form state, update action, error message, and redirect-on-success for the edit config page.
 */
export const useEditConfigPageForm = (config: Config) => {
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

  return { formState, setFormState, FormWithAction, pending, errorMessage };
};
