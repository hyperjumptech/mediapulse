"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { useFormAction } from "@/app/dashboard/agent-configs/actions/update/.generated/use-form-action";

import { AgentConfigFormFields } from "./agent-config-form-fields";
import type { AgentConfigRow } from "./agent-config-row-actions";

type AgentForDropdown = {
  id: string;
  agentId: string;
  agentVersion: string;
};

type EditConfigModalProps = {
  config: AgentConfigRow | null;
  agents: AgentForDropdown[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const initialFormState = {
  name: "",
  description: "",
  agentKey: "",
  config: {} as Record<string, unknown>,
};

/**
 * Form state synced from the config when modal opens.
 */
const useEditConfigModalState = (
  config: AgentConfigRow | null,
  open: boolean,
) => {
  const [formState, setFormState] = useState(initialFormState);

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

  return { formState, setFormState };
};

/**
 * On success: close modal and refresh.
 */
const useEditConfigModalSuccess = (
  success: boolean,
  onOpenChange: (open: boolean) => void,
  router: ReturnType<typeof useRouter>,
) => {
  const didHandleSuccess = useRef(false);
  useEffect(() => {
    if (success && !didHandleSuccess.current) {
      didHandleSuccess.current = true;
      onOpenChange(false);
      router.refresh();
    }
  }, [success, onOpenChange, router]);
};

/**
 * Modal with form to edit an existing agent config. Submits via update action; closes and refreshes on success.
 */
export const EditConfigModal = ({
  config,
  agents,
  open,
  onOpenChange,
}: EditConfigModalProps) => {
  const router = useRouter();
  const { formState, setFormState } = useEditConfigModalState(config, open);

  const { FormWithAction, state, pending } = useFormAction();
  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);
  const success = useMemo(
    () => Boolean(state && state.status === true),
    [state],
  );

  useEditConfigModalSuccess(success, onOpenChange, router);

  if (!config) return null;

  const [agentId, agentVersion] = formState.agentKey
    ? formState.agentKey.split("@")
    : ["", ""];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit config: {config.name}</DialogTitle>
        </DialogHeader>
        <FormWithAction className="flex flex-col gap-4">
          <input type="hidden" name="body.id" value={config.id} readOnly />
          <input
            type="hidden"
            name="body.name"
            value={formState.name}
            readOnly
          />
          <input
            type="hidden"
            name="body.description"
            value={formState.description}
            readOnly
          />
          <input type="hidden" name="body.agentId" value={agentId} readOnly />
          <input
            type="hidden"
            name="body.agentVersion"
            value={agentVersion}
            readOnly
          />
          <input
            type="hidden"
            name="body.config"
            value={JSON.stringify(formState.config)}
            readOnly
          />
          <AgentConfigFormFields
            name={formState.name}
            description={formState.description}
            agentKey={formState.agentKey}
            config={formState.config}
            agents={agents}
            onNameChange={(v) => setFormState((s) => ({ ...s, name: v }))}
            onDescriptionChange={(v) =>
              setFormState((s) => ({ ...s, description: v }))
            }
            onAgentChange={(v) => setFormState((s) => ({ ...s, agentKey: v }))}
            onConfigChange={(v) => setFormState((s) => ({ ...s, config: v }))}
            disabled={pending}
          />
          {errorMessage ? (
            <p className="text-destructive text-sm" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending || !formState.name || !formState.agentKey}
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};
