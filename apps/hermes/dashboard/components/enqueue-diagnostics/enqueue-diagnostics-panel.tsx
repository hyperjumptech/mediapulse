"use client";

import type { ReactNode } from "react";
import { CircleX, Copy, TriangleAlert } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import type { HermesEnqueueCorrelation } from "@hermes/scheduler/enqueue-diagnostics-correlation";

import { DateTime } from "@/components/date-time/date-time";
import type { EnqueueDiagnosticEntry } from "@/lib/enqueue-diagnostics";

import {
  useClipboardCopyFeedback,
  useKeyedClipboardCopyFeedback,
} from "./use-enqueue-diagnostics-clipboard";
import {
  useEnqueueDiagnosticsPanelViewModel,
  type EnqueueDiagnosticsTone,
} from "./use-enqueue-diagnostics-panel";

export type EnqueueDiagnosticsPanelProps = {
  enqueueStatus: string;
  errors: unknown;
  /** Execution row `metadata` JSON; used for `hermesEnqueueCorrelation` only. */
  metadata?: unknown;
};

const displayMessage = (entry: EnqueueDiagnosticEntry): string =>
  entry.message ?? entry.exception?.message ?? "(no message)";

const entryKey = (entry: EnqueueDiagnosticEntry): string =>
  entry.timestamp ?? "no-timestamp";

const optionalMeta = (
  entry: EnqueueDiagnosticEntry,
): Array<{ label: string; value: string }> => {
  const rows: Array<{ label: string; value: string }> = [];
  if (entry.severity) rows.push({ label: "Severity", value: entry.severity });
  if (entry.phase) rows.push({ label: "Phase", value: entry.phase });
  if (entry.code) rows.push({ label: "Code", value: entry.code });
  if (entry.pipelineStepId) {
    rows.push({ label: "Pipeline step", value: entry.pipelineStepId });
  }

  return rows;
};

const CorrelationSubsectionInner = ({
  rows,
}: {
  rows: Array<{ key: string; label: string; value: string }>;
}) => {
  const { copiedKey, copyForKey } = useKeyedClipboardCopyFeedback();

  return (
    <div className="rounded-md border bg-background/60 p-3">
      <h3 className="text-sm font-medium text-foreground">Correlation</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Copy into logs or support tickets to match this enqueue attempt.
      </p>
      <ul className="mt-3 list-none space-y-3 p-0">
        {rows.map(({ key, label, value }) => (
          <li key={key}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                <code className="mt-1 block break-all font-mono text-xs text-foreground">
                  {value}
                </code>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void copyForKey(key, value)}
                aria-label={`Copy ${label}`}
              >
                <Copy className="size-3.5" aria-hidden />
                {copiedKey === key ? "Copied" : "Copy"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CopyDiagnosticsJsonButton = ({ copyJson }: { copyJson: string }) => {
  const { copied, copy } = useClipboardCopyFeedback(copyJson);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5"
      onClick={() => void copy()}
      aria-label="Copy enqueue diagnostics JSON"
    >
      <Copy className="size-3.5" aria-hidden />
      {copied ? "Copied" : "Copy JSON"}
    </Button>
  );
};

const TONE_ICON = {
  warning: TriangleAlert,
  destructive: CircleX,
} as const;

const TONE_ICON_CLASS_NAME: Record<EnqueueDiagnosticsTone, string> = {
  warning: "text-warning",
  destructive: "text-destructive dark:text-red-400",
};

const TONE_DESCRIPTION: Record<EnqueueDiagnosticsTone, string> = {
  warning: "Some jobs could not be enqueued for this execution.",
  destructive: "Jobs could not be enqueued for this execution.",
};

const EnqueueDiagnosticsSectionHeader = ({
  tone,
  copyJson,
}: {
  tone: EnqueueDiagnosticsTone;
  copyJson?: string;
}) => {
  const ToneIcon = TONE_ICON[tone];
  const hasCopyJson = copyJson != null && copyJson !== "";

  return (
    <CardHeader className="gap-1 px-5">
      <CardTitle className="flex items-center gap-2">
        <ToneIcon
          aria-hidden
          className={cn("size-4 shrink-0", TONE_ICON_CLASS_NAME[tone])}
        />
        <h2
          id="enqueue-diagnostics-heading"
          className="text-base font-semibold"
        >
          Enqueue diagnostics
        </h2>
      </CardTitle>
      <CardDescription>{TONE_DESCRIPTION[tone]}</CardDescription>
      {hasCopyJson ? (
        <CardAction>
          <CopyDiagnosticsJsonButton copyJson={copyJson} />
        </CardAction>
      ) : null}
    </CardHeader>
  );
};

const EnqueueDiagnosticsCard = ({
  panelClass,
  header,
  children,
}: {
  panelClass: string;
  header: ReactNode;
  children: ReactNode;
}) => (
  <Card
    role="region"
    aria-labelledby="enqueue-diagnostics-heading"
    className={cn("min-w-0 gap-4 py-5 shadow-none", panelClass)}
  >
    {header}
    <CardContent className="flex min-w-0 flex-col gap-4 px-5">
      {children}
    </CardContent>
  </Card>
);

const CorrelationSubsection = ({
  correlation,
}: {
  correlation: HermesEnqueueCorrelation;
}) => {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  if (correlation.requestId != null && correlation.requestId !== "") {
    rows.push({
      key: "requestId",
      label: "Request id",
      value: correlation.requestId,
    });
  }
  if (correlation.workerTickId != null && correlation.workerTickId !== "") {
    rows.push({
      key: "workerTickId",
      label: "Worker tick id",
      value: correlation.workerTickId,
    });
  }
  if (rows.length === 0) return null;

  return <CorrelationSubsectionInner rows={rows} />;
};

/**
 * Surfaces persisted enqueue-phase errors on execution detail pages (failed / partial only).
 *
 * Masking and normalization run inside {@link useEnqueueDiagnosticsPanelViewModel} so the
 * panel stays thin and the derived state is easy to test with `renderHook`.
 */
export const EnqueueDiagnosticsPanel = ({
  enqueueStatus,
  errors,
  metadata,
}: EnqueueDiagnosticsPanelProps) => {
  const view = useEnqueueDiagnosticsPanelViewModel(
    enqueueStatus,
    errors,
    metadata,
  );

  if (view.status === "hidden") {
    return null;
  }

  const { panelClass, tone } = view;

  if (view.status === "invalid") {
    return (
      <EnqueueDiagnosticsCard
        panelClass={panelClass}
        header={
          <EnqueueDiagnosticsSectionHeader
            tone={tone}
            copyJson={view.copyJson}
          />
        }
      >
        {view.correlation ? (
          <CorrelationSubsection correlation={view.correlation} />
        ) : null}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-destructive">
            Invalid error payload
          </p>
          <p className="text-sm text-muted-foreground">
            {
              "This execution's errors JSON is not an array of objects. If this persists, file a bug with the raw payload below."
            }
          </p>
        </div>
        <pre
          className="max-h-48 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          tabIndex={0}
        >
          {view.payloadPreview}
        </pre>
      </EnqueueDiagnosticsCard>
    );
  }

  if (view.status === "empty") {
    return (
      <EnqueueDiagnosticsCard
        panelClass={panelClass}
        header={<EnqueueDiagnosticsSectionHeader tone={tone} />}
      >
        {view.correlation ? (
          <CorrelationSubsection correlation={view.correlation} />
        ) : null}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-foreground">
            No detailed enqueue error was recorded for this execution.
          </p>
          <p className="text-sm text-muted-foreground">
            This can happen for older rows, if the worker crashed before
            persisting diagnostics, or for platform issues. Check Hermes server
            logs around the execution time for the underlying failure.
          </p>
        </div>
      </EnqueueDiagnosticsCard>
    );
  }

  const { entries: sorted } = view;

  return (
    <EnqueueDiagnosticsCard
      panelClass={panelClass}
      header={
        <EnqueueDiagnosticsSectionHeader tone={tone} copyJson={view.copyJson} />
      }
    >
      {view.correlation ? (
        <CorrelationSubsection correlation={view.correlation} />
      ) : null}
      <ol className="list-none space-y-3 p-0">
        {sorted.map((entry, index) => (
          <li key={`${entryKey(entry)}-${index}`}>
            <article className="rounded-md border bg-background/80 p-3 text-sm">
              <p className="text-xs text-muted-foreground">
                {entry.timestamp ? (
                  <DateTime value={entry.timestamp} style="datetime" />
                ) : (
                  "(no timestamp)"
                )}
              </p>
              <p className="mt-1 wrap-break-word text-foreground">
                {displayMessage(entry)}
              </p>
              {optionalMeta(entry).length > 0 ? (
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {optionalMeta(entry).map(({ label, value }) => (
                    <div key={label} className="flex flex-wrap gap-1">
                      <dt className="font-medium text-foreground/80">
                        {label}:
                      </dt>
                      <dd className="wrap-break-word">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {entry.exception?.name != null && entry.exception.name !== "" ? (
                <p className="mt-2 font-mono text-xs text-foreground">
                  <span className="text-muted-foreground">Exception: </span>
                  {entry.exception.name}
                </p>
              ) : null}
              {entry.exception?.stack != null &&
              entry.exception.stack !== "" ? (
                <pre
                  className="mt-2 max-h-48 overflow-auto rounded-md border bg-muted p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  tabIndex={0}
                >
                  {entry.exception.stack}
                </pre>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </EnqueueDiagnosticsCard>
  );
};
