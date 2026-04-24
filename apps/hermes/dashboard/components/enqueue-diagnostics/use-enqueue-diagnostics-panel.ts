import { useMemo } from "react";

import {
  parseHermesEnqueueCorrelationFromMetadata,
  type HermesEnqueueCorrelation,
} from "@hermes/scheduler/enqueue-diagnostics-correlation";

import {
  isEnqueueDiagnosticsRelevant,
  maskEnqueueDiagnosticEntryPlainText,
  normalizeEnqueueErrorsPayload,
  safeJsonStringify,
  sortEnqueueErrorEntriesOldestFirst,
  type EnqueueDiagnosticEntry,
} from "@/lib/enqueue-diagnostics";
import { maskSecretsInJson } from "@/lib/mask-json-secrets";

export type EnqueueDiagnosticsPanelViewModel =
  | { status: "hidden" }
  | {
      status: "invalid";
      panelClass: string;
      payloadPreview: string;
      copyJson: string;
      correlation?: HermesEnqueueCorrelation;
    }
  | {
      status: "empty";
      panelClass: string;
      correlation?: HermesEnqueueCorrelation;
    }
  | {
      status: "entries";
      panelClass: string;
      entries: EnqueueDiagnosticEntry[];
      copyJson: string;
      correlation?: HermesEnqueueCorrelation;
    };

const panelClassForPartial = (isPartial: boolean): string =>
  isPartial
    ? "rounded-md border border-amber-600/40 bg-amber-500/5 p-4 text-foreground"
    : "rounded-md border border-destructive/40 bg-destructive/5 p-4 text-foreground";

const maskedDiagnosticsExportJson = (
  errorsValue: unknown,
  correlation: HermesEnqueueCorrelation | undefined,
): string => {
  const payload: Record<string, unknown> = {};
  if (correlation) {
    payload.hermesEnqueueCorrelation = correlation;
  }
  payload.errors = errorsValue;
  return safeJsonStringify(payload);
};

/**
 * Derives everything the enqueue diagnostics panel needs from `enqueueStatus` and raw
 * `errors` JSON: relevance, panel styling, masking, normalization, sorting, and
 * invalid-payload preview text. Optional `metadata` supplies enqueue correlation hints.
 */
export const useEnqueueDiagnosticsPanelViewModel = (
  enqueueStatus: string,
  errors: unknown,
  metadata?: unknown,
): EnqueueDiagnosticsPanelViewModel =>
  useMemo(() => {
    if (!isEnqueueDiagnosticsRelevant(enqueueStatus)) {
      return { status: "hidden" };
    }

    const panelClass = panelClassForPartial(enqueueStatus === "partial");
    const correlation = parseHermesEnqueueCorrelationFromMetadata(
      maskSecretsInJson(metadata),
    );
    const maskedErrors = maskSecretsInJson(errors);
    const normalized = normalizeEnqueueErrorsPayload(maskedErrors);

    if (normalized.kind === "invalid") {
      const errorsForExport = maskSecretsInJson(normalized.raw);
      return {
        status: "invalid",
        panelClass,
        payloadPreview: safeJsonStringify(errorsForExport),
        copyJson: maskedDiagnosticsExportJson(errorsForExport, correlation),
        ...(correlation ? { correlation } : {}),
      };
    }

    const sorted = sortEnqueueErrorEntriesOldestFirst(normalized.entries).map(
      maskEnqueueDiagnosticEntryPlainText,
    );

    if (sorted.length === 0) {
      return {
        status: "empty",
        panelClass,
        ...(correlation ? { correlation } : {}),
      };
    }

    return {
      status: "entries",
      panelClass,
      entries: sorted,
      copyJson: maskedDiagnosticsExportJson(sorted, correlation),
      ...(correlation ? { correlation } : {}),
    };
  }, [enqueueStatus, errors, metadata]);
