"use client";

import { useCallback, useRef, useState } from "react";

import type { PreviewExpansionResponse } from "@hermes/domain-contract";

type UseDomainTableFullPageEditorOptions = {
  /** Form field name whose value is sent to preview (from manifest `preview.fieldKey`). */
  previewFieldKey: string | undefined;
  /** Server action that runs preview for the current integration. */
  runPreview: (
    integrationKey: string,
    expansionString: string,
  ) => Promise<PreviewExpansionResponse>;
  integrationKey: string;
};

/**
 * Holds preview state and reads the preview field from the bound form via FormData.
 *
 * @param options - Preview field key, integration key, and preview runner.
 * @returns Form ref, preview UI state, and run handler for the Preview button.
 */
export const useDomainTableFullPageEditor = (
  options: UseDomainTableFullPageEditorOptions,
) => {
  const { previewFieldKey, integrationKey, runPreview } = options;
  const formRef = useRef<HTMLFormElement>(null);
  const [previewResult, setPreviewResult] =
    useState<PreviewExpansionResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const runPreviewClick = useCallback(async () => {
    if (!previewFieldKey || !formRef.current) {
      return;
    }
    const fd = new FormData(formRef.current);
    const raw = fd.get(previewFieldKey);
    const expansionString = typeof raw === "string" ? raw.trim() : "";
    if (!expansionString) {
      setPreviewError("Enter a value in the expansion field to preview.");
      setPreviewResult(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await runPreview(integrationKey, expansionString);
      setPreviewResult(result);
      if (result.success === false) {
        setPreviewError(result.error);
      } else {
        setPreviewError(null);
      }
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed.");
      setPreviewResult(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewFieldKey, integrationKey, runPreview]);

  return {
    formRef,
    previewResult,
    previewLoading,
    previewError,
    runPreviewClick,
  };
};
