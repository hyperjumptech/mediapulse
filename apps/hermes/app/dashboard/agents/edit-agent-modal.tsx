"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { useFormAction } from "@/app/dashboard/agents/actions/update/.generated/use-form-action";

import { AgentFormFields } from "./agent-form-fields";
import type { AgentsPageResult } from "@/lib/agents";

type AgentForEdit = AgentsPageResult["agents"][number];

/**
 * Converts Prisma JsonValue to a string for the endpoint textarea.
 */
const endpointToJsonString = (value: unknown): string => {
  if (value === null || value === undefined) return "{}";
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return JSON.stringify(value as Record<string, unknown>, null, 2);
  }
  return "{}";
};

type EditAgentModalProps = {
  agent: AgentForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Modal with form to edit an existing agent. Submits via update action; closes and refreshes on success.
 */
export const EditAgentModal = ({
  agent,
  open,
  onOpenChange,
}: EditAgentModalProps) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  const success = useMemo(() => state && state.status === true, [state]);
  const didHandleSuccess = useRef(false);

  useEffect(() => {
    if (open) {
      didHandleSuccess.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (success && !didHandleSuccess.current) {
      didHandleSuccess.current = true;
      onOpenChange(false);
      router.refresh();
    }
  }, [success, onOpenChange, router]);

  if (!agent) return null;

  const endpointJson = endpointToJsonString(agent.endpoint);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Edit agent: {agent.agentId}@{agent.agentVersion}
          </DialogTitle>
        </DialogHeader>
        <FormWithAction className="flex flex-col gap-4">
          <AgentFormFields
            mode="edit"
            id={agent.id}
            initialAgentId={agent.agentId}
            initialAgentVersion={agent.agentVersion}
            initialDescription={agent.description ?? ""}
            initialEndpointJson={endpointJson}
            initialIsActive={agent.isActive}
            pending={pending}
            errorMessage={errorMessage}
            submitLabel={pending ? "Saving…" : "Save changes"}
          />
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};
