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

export type EnqueueDiagnosticsTone = "warning" | "destructive";

export type EnqueueDiagnosticsPanelViewModel =
  | { status: "hidden" }
  | {
      status: "invalid";
      tone: EnqueueDiagnosticsTone;
      panelClass: string;
      payloadPreview: string;
      copyJson: string;
      correlation?: HermesEnqueueCorrelation;
    }
  | {
      status: "empty";
      tone: EnqueueDiagnosticsTone;
      panelClass: string;
      correlation?: HermesEnqueueCorrelation;
    }
  | {
      status: "entries";
      tone: EnqueueDiagnosticsTone;
      panelClass: string;
      entries: EnqueueDiagnosticEntry[];
      copyJson: string;
      correlation?: HermesEnqueueCorrelation;
    };

const PANEL_CLASS_BY_TONE: Record<EnqueueDiagnosticsTone, string> = {
  warning: "border-warning/40 bg-warning/5",
  destructive: "border-destructive/40 bg-destructive/5",
};

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

    const tone: EnqueueDiagnosticsTone =
      enqueueStatus === "partial" ? "warning" : "destructive";
    const panelClass = PANEL_CLASS_BY_TONE[tone];
    const correlation = parseHermesEnqueueCorrelationFromMetadata(
      maskSecretsInJson(metadata),
    );
    const maskedErrors = maskSecretsInJson(errors);
    const normalized = normalizeEnqueueErrorsPayload(maskedErrors);

    if (normalized.kind === "invalid") {
      const errorsForExport = maskSecretsInJson(normalized.raw);

      return {
        status: "invalid",
        tone,
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
        tone,
        panelClass,
        ...(correlation ? { correlation } : {}),
      };
    }

    return {
      status: "entries",
      tone,
      panelClass,
      entries: sorted,
      copyJson: maskedDiagnosticsExportJson(sorted, correlation),
      ...(correlation ? { correlation } : {}),
    };
  }, [enqueueStatus, errors, metadata]);
