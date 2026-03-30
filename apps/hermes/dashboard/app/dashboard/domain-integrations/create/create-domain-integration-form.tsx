"use client";

import { useActionState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import {
  createDomainIntegrationAction,
  type CreateDomainIntegrationState,
} from "./actions";

const initialState: CreateDomainIntegrationState | null = null;

/**
 * Client form: submit integration id + name; on success shows the generated API key once.
 */
export const CreateDomainIntegrationForm = () => {
  const [state, formAction, pending] = useActionState(
    createDomainIntegrationAction,
    initialState,
  );

  if (state?.ok === true) {
    return (
      <div className="max-w-lg space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">
          Integration <strong>{state.name}</strong> (id{" "}
          <strong>{state.integrationId}</strong>) is pending.
        </p>
        <p className="text-sm text-muted-foreground">
          Copy this domain integration API key now. It is not shown again. It is
          a secret—do not confuse it with the integration id above. Set{" "}
          <code className="rounded bg-muted px-1">
            DOMAIN_INTEGRATION_API_KEY
          </code>{" "}
          in Mediapulse/agent env and{" "}
          <code className="rounded bg-muted px-1">DOMAIN_INTEGRATION_ID</code>{" "}
          to <strong>{state.integrationId}</strong>.
        </p>
        <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-sm">
          {state.apiKeyPlaintext}
        </pre>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="integrationId">Integration id</Label>
        <Input
          id="integrationId"
          name="integrationId"
          required
          placeholder="Stable id for env and URLs, e.g. 'mediapulse'"
          disabled={pending}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Public identifier (not secret). Use letters, numbers, hyphens. This is
          not the API key.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Name of your system, e.g. 'Mediapulse'"
          disabled={pending}
        />
      </div>
      {state?.ok === false ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create integration"}
      </Button>
    </form>
  );
};
