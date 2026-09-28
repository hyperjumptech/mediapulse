"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";

import { useFormAction } from "@/app/dashboard/agents/actions/unregister/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";

type AgentUnregisterButtonProps = {
  agentId: string;
  agentLabel: string;
};

const useUnregisterAgentAction = () => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();
  const { open, setOpen, requestConfirmation } = useConfirmActionDialog(state);

  useEffect(() => {
    if (state && state.status === true) {
      router.push("/dashboard/agents");
    }
    if (state && state.status === false) {
      const message = state.message
        ? String(state.message)
        : "Unregister failed";
      toast.error(message);
    }
  }, [state, router]);

  return { FormWithAction, pending, open, setOpen, requestConfirmation };
};

export const AgentUnregisterButton = ({
  agentId,
  agentLabel,
}: AgentUnregisterButtonProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    useUnregisterAgentAction();
  const hiddenFields = [{ name: "body.id", value: agentId }];

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={requestConfirmation}
      >
        <Trash2 />
        {pending ? "Unregistering…" : "Unregister agent"}
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Unregister agent?"
        description={
          <>
            This removes{" "}
            <span className="font-mono text-foreground">{agentLabel}</span> from
            the registry. This cannot be undone.
          </>
        }
        confirmLabel="Unregister agent"
        pendingLabel="Unregistering…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};
