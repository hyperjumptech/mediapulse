import { useMemo } from "react";

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
    }
  | { status: "empty"; panelClass: string }
  | {
      status: "entries";
      panelClass: string;
      entries: EnqueueDiagnosticEntry[];
    };

const panelClassForPartial = (isPartial: boolean): string =>
  isPartial
    ? "rounded-md border border-amber-600/40 bg-amber-500/5 p-4 text-foreground"
    : "rounded-md border border-destructive/40 bg-destructive/5 p-4 text-foreground";

/**
 * Derives everything the enqueue diagnostics panel needs from `enqueueStatus` and raw
 * `errors` JSON: relevance, panel styling, masking, normalization, sorting, and
 * invalid-payload preview text.
 */
export const useEnqueueDiagnosticsPanelViewModel = (
  enqueueStatus: string,
  errors: unknown,
): EnqueueDiagnosticsPanelViewModel =>
  useMemo(() => {
    if (!isEnqueueDiagnosticsRelevant(enqueueStatus)) {
      return { status: "hidden" };
    }

    const panelClass = panelClassForPartial(enqueueStatus === "partial");
    const maskedErrors = maskSecretsInJson(errors);
    const normalized = normalizeEnqueueErrorsPayload(maskedErrors);

    if (normalized.kind === "invalid") {
      return {
        status: "invalid",
        panelClass,
        payloadPreview: safeJsonStringify(
          maskSecretsInJson(normalized.raw),
        ),
      };
    }

    const sorted = sortEnqueueErrorEntriesOldestFirst(normalized.entries).map(
      maskEnqueueDiagnosticEntryPlainText,
    );

    if (sorted.length === 0) {
      return { status: "empty", panelClass };
    }

    return { status: "entries", panelClass, entries: sorted };
  }, [enqueueStatus, errors]);
