"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";

import { AgentContractFormFields } from "./agent-contract-form-fields";
import type { AgentContractRow } from "./agent-contract-row-actions";
import { useEditContractModalState } from "./use-edit-contract-modal-state";

type EditContractModalProps = {
  contract: AgentContractRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const EditContractModal = ({
  contract,
  open,
  onOpenChange,
}: EditContractModalProps) => {
  const { formState, setFormState, FormWithAction, pending, errorMessage } =
    useEditContractModalState(contract, open, onOpenChange);

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit contract: {contract.name}</DialogTitle>
        </DialogHeader>
        <FormWithAction className="flex flex-col gap-4">
          <input type="hidden" name="body.id" value={contract.id} readOnly />
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
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};
