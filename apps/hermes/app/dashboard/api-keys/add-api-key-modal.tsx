"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useFormAction } from "@/app/dashboard/api-keys/actions/create/.generated/use-form-action";

import { ApiKeyFormFields } from "./api-key-form-fields";

/**
 * Hook state for the create-api-key form inside the modal.
 */
const useCreateApiKeyFormState = () => {
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message as string;
    }
    return null;
  }, [state]);

  const success = useMemo(() => {
    return (
      state &&
      state.status === true &&
      state.data?.id != null &&
      typeof (state.data as { key?: string }).key === "string"
    );
  }, [state]);

  const createdKey = useMemo(() => {
    if (state && state.status === true && state.data) {
      return (state.data as { id: string; key: string }).key ?? null;
    }
    return null;
  }, [state]);

  return { FormWithAction, pending, errorMessage, success, createdKey };
};

/**
 * Modal with form to create a new API key. On success shows the raw key once with Copy and Done.
 */
export const AddApiKeyModal = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { FormWithAction, pending, errorMessage, success, createdKey } =
    useCreateApiKeyFormState();
  const didHandleSuccess = useRef(false);
  const [showKeyStep, setShowKeyStep] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      didHandleSuccess.current = false;
      setShowKeyStep(false);
      setCopied(false);
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    if (success && createdKey && !didHandleSuccess.current) {
      didHandleSuccess.current = true;
      setShowKeyStep(true);
    }
  }, [success, createdKey]);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const handleDone = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  const handleCopy = useCallback(async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      toast.success("Copied to clipboard");
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimeoutRef.current = null;
      }, 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [createdKey]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add API key</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {showKeyStep ? "API key created" : "Add API key"}
          </DialogTitle>
        </DialogHeader>
        {showKeyStep && createdKey ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This is the only time you&apos;ll see this key. Copy it now and
              store it securely.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="api-key-value">Key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key-value"
                  type="text"
                  readOnly
                  value={createdKey}
                  className="font-mono text-sm"
                  aria-label="API key value"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCopy}
                  aria-label={copied ? "Copied" : "Copy key"}
                  aria-live="polite"
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
            <Button type="button" onClick={handleDone}>
              Done
            </Button>
          </div>
        ) : (
          <FormWithAction className="flex flex-col gap-4">
            <ApiKeyFormFields
              mode="create"
              pending={pending}
              errorMessage={errorMessage}
              submitLabel={pending ? "Creating…" : "Create API key"}
            />
          </FormWithAction>
        )}
      </DialogContent>
    </Dialog>
  );
};
