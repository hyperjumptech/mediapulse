"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@workspace/ui/components/button";
import { Trash2 } from "lucide-react";

import { useFormAction } from "@/app/dashboard/agents/actions/unregister/.generated/use-form-action";

type AgentUnregisterButtonProps = {
  /** Agent registry row id. */
  agentId: string;
  /** Human-readable label (e.g. "article-analysis@3.0.0") used in the confirm dialog. */
  agentLabel: string;
};

/**
 * Destructive button that unregisters an agent and returns to the agents list on success.
 */
export const AgentUnregisterButton = ({
  agentId,
  agentLabel,
}: AgentUnregisterButtonProps) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state && state.status === true) {
      router.push("/dashboard/agents");
      router.refresh();
    }
  }, [state, router]);

  return (
    <FormWithAction
      onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        if (
          !confirm(
            `Unregister agent "${agentLabel}"? It will be removed from the registry.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="body.id" value={agentId} readOnly />
      <Button type="submit" variant="destructive" disabled={pending}>
        <Trash2 className="mr-2 size-4" />
        {pending ? "Unregistering…" : "Unregister agent"}
      </Button>
    </FormWithAction>
  );
};
