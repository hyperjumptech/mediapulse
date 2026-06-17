"use client";

import { Badge } from "@workspace/ui/components/badge";

import { formatInvocationErrorSummary } from "@/lib/format-invocation-error";

import {
  useInvocationOutcomeDetail,
  type InvocationOutcomeDetailModel,
} from "./use-invocation-outcome-detail";

/**
 * Pretty-prints JSON for read-only display.
 *
 * @param value - Arbitrary JSON-serializable value.
 */
const formatJsonBlock = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

type JsonBlockProps = {
  title: string;
  value: unknown;
  maxHeightClass?: string;
};

/**
 * Renders a titled preformatted JSON block.
 */
const JsonBlock = ({
  title,
  value,
  maxHeightClass = "max-h-48",
}: JsonBlockProps) => (
  <div>
    <h3 className="mb-2 text-sm font-medium text-foreground">{title}</h3>
    <pre
      className={`overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed ${maxHeightClass}`}
    >
      {formatJsonBlock(value)}
    </pre>
  </div>
);

type RunSummaryCountersProps = {
  summary: Record<string, unknown>;
};

/**
 * Renders collection run counters from `details.summary`.
 */
const RunSummaryCounters = ({ summary }: RunSummaryCountersProps) => {
  const rows: Array<{ label: string; value: string }> = [];

  const pushNumber = (label: string, key: string) => {
    const value = summary[key];
    if (typeof value === "number") {
      rows.push({ label, value: String(value) });
    }
  };

  pushNumber("Run status", "status");
  pushNumber("Discovered", "discoveredCount");
  pushNumber("Persisted", "totalSources");
  pushNumber("Fetch success", "fetchSuccess");
  pushNumber("Fetch failed", "fetchFailed");
  pushNumber("Dropped (dead URL cache)", "droppedByDeadUrlCache");
  pushNumber("Dropped (fetch budget)", "droppedByFetchBudget");

  if (summary.deadlineHit === true) {
    rows.push({ label: "Deadline hit", value: "yes" });
  }

  const qualityDrops = summary.droppedByContentQuality;
  if (qualityDrops && typeof qualityDrops === "object") {
    const total = Object.values(qualityDrops as Record<string, number>).reduce(
      (sum, n) => sum + n,
      0,
    );
    if (total > 0) {
      rows.push({ label: "Content quality drops", value: String(total) });
    }
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="font-medium tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
};

export type InvocationOutcomeDetailProps = {
  transportError: unknown | null;
  agentResponse: unknown | null;
};

/**
 * Renders transport errors, agent envelope, logs, and run warnings for one invocation.
 */
export const InvocationOutcomeDetail = ({
  transportError,
  agentResponse,
}: InvocationOutcomeDetailProps) => {
  const model = useInvocationOutcomeDetail(transportError, agentResponse);

  return (
    <InvocationOutcomeDetailView
      model={model}
      transportError={transportError}
    />
  );
};

type InvocationOutcomeDetailViewProps = {
  model: InvocationOutcomeDetailModel;
  transportError: unknown | null;
};

/**
 * Presentational outcome sections (testable without the hook).
 */
export const InvocationOutcomeDetailView = ({
  model,
  transportError,
}: InvocationOutcomeDetailViewProps) => {
  const transportSummary = formatInvocationErrorSummary(transportError);
  const { envelope, runSummary, logs } = model;

  return (
    <div className="flex flex-col gap-4">
      {transportSummary ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">
            Transport error
          </h3>
          <p className="text-sm text-destructive">{transportSummary}</p>
          {transportError != null ? (
            <pre className="mt-2 max-h-32 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {formatJsonBlock(transportError)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {envelope ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">
              Agent response
            </h3>
            {envelope.status ? (
              <Badge variant="outline" className="capitalize">
                {envelope.status}
              </Badge>
            ) : null}
          </div>
          {envelope.message ? (
            <p className="text-sm text-muted-foreground">{envelope.message}</p>
          ) : null}
          {envelope.details ? (
            <JsonBlock title="Details" value={envelope.details} />
          ) : null}
        </div>
      ) : null}

      {logs && logs.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">Logs</h3>
          <ul className="max-h-48 space-y-2 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            {logs.map((entry, index) => (
              <li key={`${entry.level}-${index}`}>
                <span className="font-mono uppercase text-muted-foreground">
                  {entry.level}
                </span>
                {": "}
                <span>{entry.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {runSummary ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">
            Run summary
          </h3>
          <RunSummaryCounters summary={runSummary} />
        </div>
      ) : null}

      {!transportSummary && !envelope && !runSummary ? (
        <p className="text-sm text-muted-foreground">
          No error or outcome details recorded for this invocation.
        </p>
      ) : null}
    </div>
  );
};
