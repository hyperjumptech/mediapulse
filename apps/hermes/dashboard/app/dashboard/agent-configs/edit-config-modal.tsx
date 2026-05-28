"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

type AgentForDropdown = {
  id: string;
  agentId: string;
  agentVersion: string;
};

type EditConfigModalProps = {
  config: AgentConfigRow | null;
  agents: AgentForDropdown[];
  pickerLoaders: VariableExpansionStringFieldLoaders;
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
 * Encapsulates form state synced from config, form action, and close-on-success for edit config modal.
 */
const useEditConfigModalState = (
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

/**
 * Modal with form to edit an existing agent config. Submits via update action; closes and refreshes on success.
 */
export const EditConfigModal = ({
  config,
  agents,
  pickerLoaders,
  open,
  onOpenChange,
}: EditConfigModalProps) => {
  const { formState, setFormState, FormWithAction, pending, errorMessage } =
    useEditConfigModalState(config, open, onOpenChange);

  if (!config) return null;

  const [agentId, agentVersion] = formState.agentKey
    ? formState.agentKey.split("@")
    : ["", ""];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
            pickerLoaders={pickerLoaders}
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
