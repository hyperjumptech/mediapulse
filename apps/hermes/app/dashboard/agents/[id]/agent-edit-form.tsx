"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import { useFormAction } from "@/app/dashboard/agents/actions/update/.generated/use-form-action";

/**
 * Edit agent form: agent ID, version, description, endpoint (JSON), and active. Uses update action; refreshes on success.
 */
export const AgentEditForm = ({
  id,
  initialAgentId,
  initialAgentVersion,
  initialDescription,
  initialEndpointJson,
  initialIsActive,
}: {
  id: string;
  initialAgentId: string;
  initialAgentVersion: string;
  initialDescription: string;
  initialEndpointJson: string;
  initialIsActive: boolean;
}) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message;
    return null;
  }, [state]);

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <FormWithAction className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="body.id" value={id} readOnly />
      <div className="grid gap-2">
        <Label htmlFor="body.agentId">Agent ID</Label>
        <Input
          id="body.agentId"
          name="body.agentId"
          type="text"
          defaultValue={initialAgentId}
          required
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.agentVersion">Agent version</Label>
        <Input
          id="body.agentVersion"
          name="body.agentVersion"
          type="text"
          defaultValue={initialAgentVersion}
          required
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.description">Description (optional)</Label>
        <Input
          id="body.description"
          name="body.description"
          type="text"
          defaultValue={initialDescription}
          placeholder="Short description"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.endpoint">Endpoint (JSON object)</Label>
        <textarea
          id="body.endpoint"
          name="body.endpoint"
          defaultValue={initialEndpointJson}
          rows={10}
          disabled={pending}
          placeholder='{"url": "https://api.example.com"}'
          className={cn(
            "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <p className="text-xs text-muted-foreground">
          Must be a valid JSON object. Leave unchanged to keep current endpoint.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input type="hidden" name="body.isActive" value="false" />
        <input
          type="checkbox"
          id="body.isActive"
          name="body.isActive"
          value="true"
          defaultChecked={initialIsActive}
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
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </FormWithAction>
  );
};
