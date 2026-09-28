"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { FormErrorAlert } from "@/components/form-error-alert";
import { OneTimeSecretReveal } from "@/components/one-time-secret-reveal";
import { SubmitButton } from "@/components/submit-button";

import {
  createDomainIntegrationAction,
  type CreateDomainIntegrationState,
} from "./actions";

const initialState: CreateDomainIntegrationState | null = null;

const DOMAIN_INTEGRATIONS_PATH = "/dashboard/domain-integrations";

type CreatedDomainIntegrationProps = {
  name: string;
  integrationId: string;
  apiKeyPlaintext: string;
};

const CreatedDomainIntegration = ({
  name,
  integrationId,
  apiKeyPlaintext,
}: CreatedDomainIntegrationProps) => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <CircleCheck className="size-5 text-success" aria-hidden="true" />
        Integration created
      </CardTitle>
      <CardDescription>
        Integration <strong className="text-foreground">{name}</strong> (id{" "}
        <strong className="text-foreground">{integrationId}</strong>) is
        pending.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <OneTimeSecretReveal
        secret={apiKeyPlaintext}
        secretLabel="Domain integration API key"
      >
        This is a secret. Do not confuse it with the integration id above.
      </OneTimeSecretReveal>
      <p className="text-sm text-muted-foreground">
        Set{" "}
        <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">
          DOMAIN_INTEGRATION_API_KEY
        </code>{" "}
        in your domain-api/agent env and{" "}
        <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">
          DOMAIN_INTEGRATION_ID
        </code>{" "}
        to <strong className="text-foreground">{integrationId}</strong>.
      </p>
    </CardContent>
    <CardFooter className="justify-end border-t">
      <Button asChild>
        <Link href={DOMAIN_INTEGRATIONS_PATH}>Done</Link>
      </Button>
    </CardFooter>
  </Card>
);

export const CreateDomainIntegrationForm = () => {
  const [state, formAction, pending] = useActionState(
    createDomainIntegrationAction,
    initialState,
  );

  if (state?.ok === true) {
    return (
      <CreatedDomainIntegration
        name={state.name}
        integrationId={state.integrationId}
        apiKeyPlaintext={state.apiKeyPlaintext}
      />
    );
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardDescription>
          Creating an integration generates an API key that your system uses to
          register with Hermes.
        </CardDescription>
      </CardHeader>
      <form action={formAction} className="flex flex-col gap-6">
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="integrationId">Integration id</FieldLabel>
              <Input
                id="integrationId"
                name="integrationId"
                required
                placeholder="Stable id for env and URLs, e.g. 'acme-crm'"
                disabled={pending}
                autoComplete="off"
                className="font-mono"
              />
              <FieldDescription>
                Public identifier (not secret). Use letters, numbers, hyphens.
                This is not the API key.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="name">Display name</FieldLabel>
              <Input
                id="name"
                name="name"
                required
                placeholder="Name of your system, e.g. 'Acme CRM'"
                disabled={pending}
              />
            </Field>
            {state?.ok === false ? (
              <FormErrorAlert message={state.error} />
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="ghost" asChild>
            <Link href={DOMAIN_INTEGRATIONS_PATH}>Cancel</Link>
          </Button>
          <SubmitButton pending={pending} pendingLabel="Creating…">
            Create integration
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
};
