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
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useFormAction } from "@/app/dashboard/agents/actions/create/.generated/use-form-action";

/**
 * Hook state for the create-agent form inside the modal.
 */
const useCreateAgentFormState = () => {
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
 * Modal with form to create a new agent. Submits via create action; closes and refreshes on success.
 */
export const AddAgentModal = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { FormWithAction, pending, errorMessage, success } =
    useCreateAgentFormState();

  useEffect(() => {
    if (success) {
      setOpen(false);
      router.refresh();
    }
  }, [success, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add agent</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add agent</DialogTitle>
        </DialogHeader>
        <FormWithAction className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="body.agentId">Agent ID</Label>
            <Input
              id="body.agentId"
              name="body.agentId"
              type="text"
              required
              placeholder="e.g. summarizer"
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body.agentVersion">Agent version</Label>
            <Input
              id="body.agentVersion"
              name="body.agentVersion"
              type="text"
              required
              placeholder="e.g. 1.0"
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body.description">Description (optional)</Label>
            <Input
              id="body.description"
              name="body.description"
              type="text"
              placeholder="Short description"
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body.endpoint">Endpoint (JSON object)</Label>
            <textarea
              id="body.endpoint"
              name="body.endpoint"
              rows={4}
              required
              disabled={pending}
              placeholder='{"url": "https://api.example.com"}'
              className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              Must be a valid JSON object. Invalid JSON will cause validation to
              fail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input type="hidden" name="body.isActive" value="false" />
            <input
              type="checkbox"
              id="body.isActive"
              name="body.isActive"
              value="true"
              defaultChecked
              disabled={pending}
              className="size-4 rounded border-input"
            />
            <Label
              htmlFor="body.isActive"
              className="cursor-pointer text-sm font-normal"
            >
              Active
            </Label>
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create agent"}
          </Button>
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};
