"use client";

import { Copy } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import type { HermesEnqueueCorrelation } from "@hermes/scheduler/enqueue-diagnostics-correlation";

import type { EnqueueDiagnosticEntry } from "@/lib/enqueue-diagnostics";

import { useEnqueueDiagnosticsPanelViewModel } from "./use-enqueue-diagnostics-panel";

export type EnqueueDiagnosticsPanelProps = {
  enqueueStatus: string;
  errors: unknown;
  /** Execution row `metadata` JSON; used for `hermesEnqueueCorrelation` only. */
  metadata?: unknown;
};

const displayMessage = (entry: EnqueueDiagnosticEntry): string =>
  entry.message ?? entry.exception?.message ?? "(no message)";

const displayTimestamp = (entry: EnqueueDiagnosticEntry): string =>
  entry.timestamp ?? "(no timestamp)";

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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const onCopy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  return (
    <div className="mt-4 rounded-md border border-border/80 bg-muted/40 p-3">
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
                onClick={() => void onCopy(key, value)}
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
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [copyJson]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5 self-start sm:self-auto"
      onClick={() => void onCopy()}
      aria-label="Copy enqueue diagnostics JSON"
    >
      <Copy className="size-3.5" aria-hidden />
      {copied ? "Copied" : "Copy JSON"}
    </Button>
  );
};

const EnqueueDiagnosticsSectionHeader = ({
  copyJson,
}: {
  copyJson?: string;
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
    <h2 id="enqueue-diagnostics-heading" className="text-lg font-medium">
      Enqueue diagnostics
    </h2>
    {copyJson != null && copyJson !== "" ? (
      <CopyDiagnosticsJsonButton copyJson={copyJson} />
    ) : null}
  </div>
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

  const { panelClass } = view;

  if (view.status === "invalid") {
    return (
      <section
        className={panelClass}
        role="region"
        aria-labelledby="enqueue-diagnostics-heading"
      >
        <EnqueueDiagnosticsSectionHeader copyJson={view.copyJson} />
        {view.correlation ? (
          <CorrelationSubsection correlation={view.correlation} />
        ) : null}
        <p className="mt-2 text-sm font-medium text-destructive">
          Invalid error payload
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {
            "This execution's errors JSON is not an array of objects. If this persists, file a bug with the raw payload below."
          }
        </p>
        <pre
          className="mt-3 max-h-48 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          tabIndex={0}
        >
          {view.payloadPreview}
        </pre>
      </section>
    );
  }

  if (view.status === "empty") {
    return (
      <section
        className={panelClass}
        role="region"
        aria-labelledby="enqueue-diagnostics-heading"
      >
        <EnqueueDiagnosticsSectionHeader />
        {view.correlation ? (
          <CorrelationSubsection correlation={view.correlation} />
        ) : null}
        <p className="mt-2 text-sm text-foreground">
          No detailed enqueue error was recorded for this execution.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          This can happen for older rows, if the worker crashed before
          persisting diagnostics, or for platform issues. Check Hermes server
          logs around the execution time for the underlying failure.
        </p>
      </section>
    );
  }

  const { entries: sorted } = view;

  return (
    <section
      className={panelClass}
      role="region"
      aria-labelledby="enqueue-diagnostics-heading"
    >
      <EnqueueDiagnosticsSectionHeader copyJson={view.copyJson} />
      {view.correlation ? (
        <CorrelationSubsection correlation={view.correlation} />
      ) : null}
      <ol className="mt-4 list-none space-y-4 p-0">
        {sorted.map((entry, index) => (
          <li key={`${displayTimestamp(entry)}-${index}`}>
            <article className="rounded-md border bg-background/80 p-3 text-sm shadow-sm">
              <p className="text-xs text-muted-foreground">
                {displayTimestamp(entry)}
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
    </section>
  );
};
