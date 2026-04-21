import {
  isEnqueueDiagnosticsRelevant,
  normalizeEnqueueErrorsPayload,
  safeJsonStringify,
  sortEnqueueErrorEntriesOldestFirst,
  type EnqueueDiagnosticEntry,
} from "@/lib/enqueue-diagnostics";

export type EnqueueDiagnosticsPanelProps = {
  enqueueStatus: string;
  errors: unknown;
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

/**
 * Surfaces persisted enqueue-phase errors on execution detail pages (failed / partial only).
 */
export const EnqueueDiagnosticsPanel = ({
  enqueueStatus,
  errors,
}: EnqueueDiagnosticsPanelProps) => {
  if (!isEnqueueDiagnosticsRelevant(enqueueStatus)) {
    return null;
  }

  const isPartial = enqueueStatus === "partial";
  const panelClass = isPartial
    ? "rounded-md border border-amber-600/40 bg-amber-500/5 p-4 text-foreground"
    : "rounded-md border border-destructive/40 bg-destructive/5 p-4 text-foreground";

  const normalized = normalizeEnqueueErrorsPayload(errors);

  if (normalized.kind === "invalid") {
    return (
      <section
        className={panelClass}
        role="region"
        aria-labelledby="enqueue-diagnostics-heading"
      >
        <h2 id="enqueue-diagnostics-heading" className="text-lg font-medium">
          Enqueue diagnostics
        </h2>
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
          {safeJsonStringify(normalized.raw)}
        </pre>
      </section>
    );
  }

  const sorted = sortEnqueueErrorEntriesOldestFirst(normalized.entries);

  if (sorted.length === 0) {
    return (
      <section
        className={panelClass}
        role="region"
        aria-labelledby="enqueue-diagnostics-heading"
      >
        <h2 id="enqueue-diagnostics-heading" className="text-lg font-medium">
          Enqueue diagnostics
        </h2>
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

  return (
    <section
      className={panelClass}
      role="region"
      aria-labelledby="enqueue-diagnostics-heading"
    >
      <h2 id="enqueue-diagnostics-heading" className="text-lg font-medium">
        Enqueue diagnostics
      </h2>
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
