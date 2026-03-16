"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { useFormAction } from "@/app/dashboard/api-keys/actions/update/.generated/use-form-action";

import { ApiKeyFormFields } from "./api-key-form-fields";
import type { ApiKeysPageResult } from "@/lib/api-keys";

type ApiKeyForEdit = ApiKeysPageResult["apiKeys"][number];

type EditApiKeyModalProps = {
  apiKey: ApiKeyForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Encapsulates edit-api-key form state and close-on-success behavior.
 */
const useEditApiKeyModalState = (
  open: boolean,
  onOpenChange: (open: boolean) => void,
) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();
  const didHandleSuccess = useRef(false);

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  const success = useMemo(() => state && state.status === true, [state]);

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

  return { FormWithAction, pending, errorMessage };
};

/**
 * Modal with form to edit an existing API key (name, isActive). Submits via update action; closes and refreshes on success.
 */
export const EditApiKeyModal = ({
  apiKey,
  open,
  onOpenChange,
}: EditApiKeyModalProps) => {
  const { FormWithAction, pending, errorMessage } = useEditApiKeyModalState(
    open,
    onOpenChange,
  );

  if (!apiKey) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit API key: {apiKey.name}</DialogTitle>
        </DialogHeader>
        <FormWithAction className="flex flex-col gap-4">
          <ApiKeyFormFields
            mode="edit"
            id={apiKey.id}
            initialName={apiKey.name}
            initialIsActive={apiKey.isActive}
            pending={pending}
            errorMessage={errorMessage}
            submitLabel={pending ? "Saving…" : "Save changes"}
          />
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};
