"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { useFormAction } from "@/app/dashboard/agent-configs/actions/create/.generated/use-form-action";

import { AgentConfigFormFields } from "./agent-config-form-fields";
import type { AgentConfigRow } from "./agent-config-row-actions";
import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

type AgentForDropdown = {
  id: string;
  agentId: string;
  agentVersion: string;
};

type AddConfigModalProps = {
  agents: AgentForDropdown[];
  pickerLoaders: VariableExpansionStringFieldLoaders;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialData?: AgentConfigRow | null;
  trigger?: React.ReactNode;
};

const emptyForm = {
  name: "",
  description: "",
  agentKey: "",
  config: {} as Record<string, unknown>,
};

/**
 * Encapsulates open/form state, form action, and close-on-success for add config modal.
 */
const useAddConfigModalState = (
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

/**
 * Modal with form to create a new agent config (or duplicate when initialData is set).
 * Submits via create action; closes and refreshes on success.
 */
export const AddConfigModal = ({
  agents,
  pickerLoaders,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialData,
  trigger = <Button>Add config</Button>,
}: AddConfigModalProps) => {
  const {
    open,
    setOpen,
    formState,
    setFormState,
    FormWithAction,
    pending,
    errorMessage,
  } = useAddConfigModalState(
    controlledOpen,
    controlledOnOpenChange,
    initialData,
  );

  const [agentId, agentVersion] = formState.agentKey
    ? formState.agentKey.split("@")
    : ["", ""];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger != null && !initialData ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Duplicate config" : "Add config"}
          </DialogTitle>
        </DialogHeader>
        <FormWithAction className="flex flex-col gap-4">
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
            {pending
              ? "Creating…"
              : initialData
                ? "Create copy"
                : "Create config"}
          </Button>
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};
