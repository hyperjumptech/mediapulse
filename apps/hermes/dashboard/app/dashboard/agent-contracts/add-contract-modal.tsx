"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";

import { AgentContractFormFields } from "./agent-contract-form-fields";
import { useAddContractModalState } from "./use-add-contract-modal-state";

type AddContractModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
};

export const AddContractModal = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger = <Button>Add contract</Button>,
}: AddContractModalProps) => {
  const {
    open,
    setOpen,
    formState,
    setFormState,
    FormWithAction,
    pending,
    errorMessage,
  } = useAddContractModalState(controlledOpen, controlledOnOpenChange);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger != null ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add contract</DialogTitle>
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
          <input
            type="hidden"
            name="body.brief"
            value={formState.brief}
            readOnly
          />
          <input
            type="hidden"
            name="body.version"
            value={formState.version}
            readOnly
          />
          <AgentContractFormFields
            name={formState.name}
            description={formState.description}
            brief={formState.brief}
            version={formState.version}
            onNameChange={(v) => setFormState((s) => ({ ...s, name: v }))}
            onDescriptionChange={(v) =>
              setFormState((s) => ({ ...s, description: v }))
            }
            onBriefChange={(v) => setFormState((s) => ({ ...s, brief: v }))}
            onVersionChange={(v) => setFormState((s) => ({ ...s, version: v }))}
            disabled={pending}
          />
          {errorMessage ? (
            <p className="text-destructive text-sm" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={
              pending ||
              !formState.name ||
              !formState.brief ||
              !formState.version
            }
          >
            {pending ? "Creating…" : "Create contract"}
          </Button>
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};
