"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";

import { AgentConfigFormFields } from "./agent-config-form-fields";
import type { AgentConfigRow } from "./agent-config-row-actions";
import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";
import { useAddConfigModalState } from "./use-add-config-modal-state";

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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
