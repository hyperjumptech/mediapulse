"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { useFormAction } from "@/app/dashboard/tickers/actions/create/.generated/use-form-action";
import { RouteClient } from "@/app/dashboard/tickers/actions/import/.generated/client";

/**
 * Hook state for the create-ticker form inside the modal.
 */
const useCreateTickerFormState = () => {
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message as string;
    }
    return null;
  }, [state]);

  const success = useMemo(() => {
    return state && state.status === true && state.data?.id != null;
  }, [state]);

  return { FormWithAction, pending, errorMessage, success };
};

/**
 * Hook for import JSON: file handling, submit, and result.
 */
const useImportTickers = (onClose: () => void) => {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [importPending, setImportPending] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    added: number;
    updated: number;
  } | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = e.target.files?.[0];
      setFile(chosen ?? null);
      setImportError(null);
      setImportResult(null);
    },
    [],
  );

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped?.name.endsWith(".json")) {
      setFile(dropped);
      setImportError(null);
      setImportResult(null);
    } else {
      setImportError("Please drop a JSON file.");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleImportSubmit = useCallback(async () => {
    if (!file) {
      setImportError("Select or drop a JSON file first.");
      return;
    }
    setImportPending(true);
    setImportError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { data?: unknown }).data)
      ) {
        setImportError("Invalid IDX format: expected object with data array.");
        return;
      }
      const client = new RouteClient();
      const result = await client.post({
        body: { payloadJson: JSON.stringify(parsed) },
      });
      setImportResult({ added: result.added, updated: result.updated });
      router.refresh();
      setTimeout(onClose, 1500);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImportPending(false);
    }
  }, [file, onClose, router]);

  return {
    file,
    handleFileChange,
    handleDrop,
    handleDragOver,
    handleImportSubmit,
    importPending,
    importError,
    importResult,
  };
};

/**
 * Modal with tabs: Create new ticker and Import from JSON.
 * Renders a trigger button and dialog content with forms.
 */
export const AddImportTickersModal = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { FormWithAction, pending, errorMessage, success } =
    useCreateTickerFormState();
  const {
    file,
    handleFileChange,
    handleDrop,
    handleDragOver,
    handleImportSubmit,
    importPending,
    importError,
    importResult,
  } = useImportTickers(() => setOpen(false));

  useEffect(() => {
    if (success) {
      setOpen(false);
      router.refresh();
    }
  }, [success, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add / Import tickers</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add or import tickers</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create new ticker</TabsTrigger>
            <TabsTrigger value="import">Import from JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="space-y-4 pt-4">
            <FormWithAction className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="body.symbol">Symbol</Label>
                <Input
                  id="body.symbol"
                  name="body.symbol"
                  type="text"
                  required
                  placeholder="e.g. AAPL"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body.name">Name</Label>
                <Input
                  id="body.name"
                  name="body.name"
                  type="text"
                  required
                  placeholder="Company name"
                  disabled={pending}
                />
              </div>
              {errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage}
                </p>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create ticker"}
              </Button>
            </FormWithAction>
          </TabsContent>
          <TabsContent value="import" className="space-y-4 pt-4">
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                or drag and drop a JSON file (
                <a
                  className="underline"
                  href="https://www.idx.co.id/Primary/ListedCompany/GetCompanyProfiles?emitenType=&start=0&length=9999"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  IDX format
                </a>
                )
              </p>
              {file ? <p className="text-sm font-medium">{file.name}</p> : null}
            </div>
            {importError ? (
              <p className="text-sm text-destructive" role="alert">
                {importError}
              </p>
            ) : null}
            {importResult ? (
              <p className="text-sm text-muted-foreground" role="status">
                {importResult.added} added, {importResult.updated} updated.
              </p>
            ) : null}
            <Button
              type="button"
              onClick={handleImportSubmit}
              disabled={!file || importPending}
            >
              {importPending ? "Importing…" : "Import"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
