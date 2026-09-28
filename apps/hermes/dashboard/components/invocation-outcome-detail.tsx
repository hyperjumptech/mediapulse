"use client";

import { JsonBlock } from "@/components/json-block";
import { StatusBadge } from "@/components/status-badge";
import { formatInvocationErrorSummary } from "@/lib/format-invocation-error";

import {
  useInvocationOutcomeDetail,
  type InvocationOutcomeDetailModel,
} from "./use-invocation-outcome-detail";

type RunSummaryCountersProps = {
  summary: Record<string, unknown>;
};

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
  pushNumber("Dropped (run item cap)", "droppedByRunItemCap");
  pushNumber("Dropped (URL noise)", "droppedByUrlNoise");
  pushNumber("Dropped (duplicate URL)", "droppedByDuplicateCanonicalUrl");
  pushNumber("Dropped (already collected)", "droppedByExistingCanonicalUrl");
  pushNumber("Dropped (dead URL cache)", "droppedByDeadUrlCache");
  pushNumber("Dropped (host error rate)", "droppedByHostErrorRate");
  pushNumber("Dropped (candidate budget)", "droppedByCandidateBudget");
  pushNumber("Fetch success", "fetchSuccess");
  pushNumber("Fetch failed", "fetchFailed");
  pushNumber("Persisted", "totalSources");

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
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex min-w-0 items-baseline justify-between gap-3"
        >
          <dt className="min-w-0 text-muted-foreground">{row.label}</dt>
          <dd className="shrink-0 font-medium tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
};

export type InvocationOutcomeDetailProps = {
  transportError: unknown | null;
  agentResponse: unknown | null;
};

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

export const InvocationOutcomeDetailView = ({
  model,
  transportError,
}: InvocationOutcomeDetailViewProps) => {
  const transportSummary = formatInvocationErrorSummary(transportError);
  const { envelope, runSummary, logs } = model;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {transportSummary ? (
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">
            Transport error
          </h3>
          <p className="text-sm break-words text-destructive">
            {transportSummary}
          </p>
          {transportError != null ? (
            <JsonBlock value={transportError} maxHeight="max-h-48" />
          ) : null}
        </div>
      ) : null}

      {envelope ? (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">
              Agent response
            </h3>
            {envelope.status ? <StatusBadge status={envelope.status} /> : null}
          </div>
          {envelope.message ? (
            <p className="text-sm break-words text-muted-foreground">
              {envelope.message}
            </p>
          ) : null}
          {envelope.details ? (
            <JsonBlock title="Details" value={envelope.details} />
          ) : null}
        </div>
      ) : null}

      {logs && logs.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Logs</h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-xs">
            {logs.map((entry, index) => (
              <li key={`${entry.level}-${index}`} className="break-words">
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
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Run summary</h3>
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
