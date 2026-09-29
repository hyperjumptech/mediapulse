"use client";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import type { PipelineOption } from "../schedules/schedule-form-fields";
import {
  useHttpTriggerStartMode,
  type HttpTriggerStartMode,
} from "./use-http-trigger-start-mode";

const HTTP_METHOD_OPTIONS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
type HttpMethodOption = (typeof HTTP_METHOD_OPTIONS)[number];

export type HttpTriggerFormFieldsProps = {
  pending: boolean;
  pipelines: PipelineOption[];
  defaultName: string;
  defaultDescription: string;
  defaultPipelineId: string;
  defaultEnabled: boolean;
  defaultMethod: HttpMethodOption;
  defaultTokenHint?: string | null;
  defaultStartMode?: HttpTriggerStartMode;
  defaultEventName?: string;
  httpTriggerId?: string;
  isEdit?: boolean;
};

/**
 * Form fields for create/edit HTTP trigger.
 */
export const HttpTriggerFormFields = ({
  pending,
  pipelines,
  defaultName,
  defaultDescription,
  defaultPipelineId,
  defaultEnabled,
  defaultMethod,
  defaultTokenHint,
  defaultStartMode = "token",
  defaultEventName = "",
  httpTriggerId,
  isEdit = false,
}: HttpTriggerFormFieldsProps) => {
  const { startMode, changeStartMode } =
    useHttpTriggerStartMode(defaultStartMode);
  const isEventMode = startMode === "event";
  const tokenLabel = isEdit
    ? "Bearer token (leave blank to keep current)"
    : "Bearer token";
  const tokenPlaceholder = defaultTokenHint
    ? `Current token ends with ${defaultTokenHint}`
    : "";

  return (
    <FieldGroup>
      {httpTriggerId ? (
        <input type="hidden" name="body.httpTriggerId" value={httpTriggerId} />
      ) : null}
      <Field>
        <FieldLabel htmlFor="http-trigger-name">Name</FieldLabel>
        <Input
          id="http-trigger-name"
          name="body.name"
          defaultValue={defaultName}
          required
          disabled={pending}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="http-trigger-description">Description</FieldLabel>
        <Input
          id="http-trigger-description"
          name="body.description"
          defaultValue={defaultDescription}
          disabled={pending}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="http-trigger-start-mode">Started by</FieldLabel>
        <NativeSelect
          id="http-trigger-start-mode"
          name="body.startMode"
          value={startMode}
          onChange={(event) => changeStartMode(event.target.value)}
          disabled={pending}
        >
          <NativeSelectOption value="token">
            A call to its URL with a bearer token
          </NativeSelectOption>
          <NativeSelectOption value="event">
            An event sent by a domain integration
          </NativeSelectOption>
        </NativeSelect>
      </Field>
      <div
        className={
          isEventMode
            ? "grid gap-7"
            : "grid gap-7 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-4"
        }
      >
        <Field>
          <FieldLabel htmlFor="http-trigger-pipeline">Pipeline</FieldLabel>
          <NativeSelect
            id="http-trigger-pipeline"
            name="body.pipelineId"
            defaultValue={defaultPipelineId}
            required
            disabled={pending}
          >
            <NativeSelectOption value="" disabled>
              Select a pipeline
            </NativeSelectOption>
            {pipelines.map((pipeline) => (
              <NativeSelectOption key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {isEventMode ? (
          <input type="hidden" name="body.method" value="POST" />
        ) : (
          <Field>
            <FieldLabel htmlFor="http-trigger-method">Method</FieldLabel>
            <NativeSelect
              id="http-trigger-method"
              name="body.method"
              defaultValue={defaultMethod}
              required
              disabled={pending}
            >
              {HTTP_METHOD_OPTIONS.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      {isEventMode ? (
        <Field>
          <FieldLabel htmlFor="http-trigger-event-name">Event name</FieldLabel>
          <Input
            id="http-trigger-event-name"
            name="body.eventName"
            defaultValue={defaultEventName}
            required
            pattern="[a-z0-9][a-z0-9._\-]{0,99}"
            autoComplete="off"
            disabled={pending}
          />
          <FieldDescription>
            The pipeline runs each time the pipeline&apos;s domain integration
            sends this event, for example <code>order.created</code>. Run
            parameters sent with the event fill <code>{"{{params.name}}"}</code>{" "}
            placeholders.
          </FieldDescription>
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="http-trigger-token">{tokenLabel}</FieldLabel>
          <Input
            id="http-trigger-token"
            name="body.bearerToken"
            type="password"
            required={!isEdit || defaultStartMode === "event"}
            placeholder={tokenPlaceholder}
            autoComplete="new-password"
            disabled={pending}
          />
          <FieldDescription>
            Callers send this token in the Authorization header.
          </FieldDescription>
        </Field>
      )}
      <FormBooleanCheckboxField
        name="body.enabled"
        id="http-trigger-enabled"
        defaultChecked={defaultEnabled}
        checkedSubmitValue="on"
        disabled={pending}
        label="Enabled"
      />
    </FieldGroup>
  );
};
