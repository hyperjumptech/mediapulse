"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useFormAction } from "@/app/dashboard/api-keys/actions/create/.generated/use-form-action";

type CreateApiKeyModalProps = {
  trigger?: React.ReactNode;
};

type CreateSuccessPayload = {
  id: string;
  label: string;
  readOnly: boolean;
  apiKeyPlaintext: string;
};

/**
 * Owns create-key dialog state, one-time secret display, and refresh after dismiss.
 */
const useCreateApiKeyModalState = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateSuccessPayload | null>(
    null,
  );
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(
    () => (state && state.status === false ? String(state.message) : null),
    [state],
  );

  const successPayload = useMemo((): CreateSuccessPayload | null => {
    if (state?.status !== true || !state.data) {
      return null;
    }
    const data = state.data as CreateSuccessPayload;
    if (!data.apiKeyPlaintext) {
      return null;
    }
    return data;
  }, [state]);

  const handledSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    if (successPayload && handledSuccessRef.current !== successPayload.id) {
      handledSuccessRef.current = successPayload.id;
      setCreatedKey(successPayload);
    }
  }, [successPayload]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      if (createdKey) {
        router.refresh();
      }
      setCreatedKey(null);
      handledSuccessRef.current = null;
    }
  };

  return {
    open,
    handleOpenChange,
    FormWithAction,
    pending,
    errorMessage,
    createdKey,
  };
};

/**
 * Copy-to-clipboard state for the one-time key reveal panel.
 */
const useApiKeyCopyState = (apiKeyPlaintext: string) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKeyPlaintext);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return { copied, copyToClipboard };
};

type ApiKeyRevealPanelProps = {
  apiKeyPlaintext: string;
};

/** Shows the one-time MCP API key with a copy button. */
const ApiKeyRevealPanel = ({ apiKeyPlaintext }: ApiKeyRevealPanelProps) => {
  const { copied, copyToClipboard } = useApiKeyCopyState(apiKeyPlaintext);

  return (
    <ApiKeyRevealContent
      apiKeyPlaintext={apiKeyPlaintext}
      copied={copied}
      onCopy={copyToClipboard}
    />
  );
};

const ApiKeyRevealContent = ({
  apiKeyPlaintext,
  copied,
  onCopy,
}: {
  apiKeyPlaintext: string;
  copied: boolean;
  onCopy: () => void;
}) => (
  <div className="space-y-3">
    <p className="text-sm text-muted-foreground">
      Copy this key now. It is not shown again. Paste it into Cursor MCP
      secrets, not git.
    </p>
    <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-sm">
      {apiKeyPlaintext}
    </pre>
    <Button type="button" variant="secondary" onClick={onCopy}>
      {copied ? "Copied" : "Copy to clipboard"}
    </Button>
  </div>
);

type CreateApiKeyFormFieldsProps = {
  errorMessage: string | null;
  pending: boolean;
};

/** Fields for the create API key form. */
const CreateApiKeyFormFields = ({
  errorMessage,
  pending,
}: CreateApiKeyFormFieldsProps) => (
  <>
    <div className="flex flex-col gap-2">
      <Label htmlFor="mcp-key-label">Label</Label>
      <Input
        id="mcp-key-label"
        name="body.label"
        required
        disabled={pending}
        placeholder="e.g. Cursor prod read-only"
        autoComplete="off"
      />
    </div>
    <FormBooleanCheckboxField
      id="mcp-key-read-only"
      name="body.readOnly"
      defaultChecked={false}
      checkedSubmitValue="true"
      disabled={pending}
      label="Read-only (no dashboard mutations via MCP)"
      labelClassName="font-normal"
    />
    {errorMessage ? (
      <p className="text-sm text-destructive" role="alert">
        {errorMessage}
      </p>
    ) : null}
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create key"}
    </Button>
  </>
);

/**
 * Modal to create an MCP API key; shows the secret exactly once after success.
 */
export const CreateApiKeyModal = ({ trigger }: CreateApiKeyModalProps) => {
  const {
    open,
    handleOpenChange,
    FormWithAction,
    pending,
    errorMessage,
    createdKey,
  } = useCreateApiKeyModalState();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {createdKey ? "Copy your API key" : "Create API key"}
          </DialogTitle>
        </DialogHeader>
        {createdKey ? (
          <ApiKeyRevealPanel apiKeyPlaintext={createdKey.apiKeyPlaintext} />
        ) : (
          <FormWithAction className="flex flex-col gap-4">
            <CreateApiKeyFormFields
              errorMessage={errorMessage}
              pending={pending}
            />
          </FormWithAction>
        )}
        <DialogFooter>
          {createdKey ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
