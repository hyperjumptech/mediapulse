import { useEffect, useState } from "react";

import { formatPipelineTimeoutPreview } from "@/lib/format-pipeline-timeout-preview";

/**
 * Stringifies the initial timeout for preview (same rules as the timeout input `defaultValue`).
 *
 * @param defaultTimeoutMs - Optional positive timeout from the server.
 * @returns Digits for the input default, or empty when unset.
 */
const defaultTimeoutString = (defaultTimeoutMs?: number): string =>
  defaultTimeoutMs != null && defaultTimeoutMs > 0
    ? String(defaultTimeoutMs)
    : "";

/**
 * Live helper text for the pipeline agent-timeout field while keeping the input uncontrolled for form POST.
 *
 * @param defaultTimeoutMs - Initial timeout from the server when editing or undefined for create.
 * @returns Preview string, reset when `defaultTimeoutMs` changes, and an `onInput` handler for the timeout field.
 */
export const usePipelineTimeoutPreview = (
  defaultTimeoutMs?: number,
): {
  timeoutPreviewText: string;
  onTimeoutInput: React.FormEventHandler<HTMLInputElement>;
} => {
  const [timeoutPreviewText, setTimeoutPreviewText] = useState(() =>
    formatPipelineTimeoutPreview(defaultTimeoutString(defaultTimeoutMs)),
  );

  useEffect(() => {
    setTimeoutPreviewText(
      formatPipelineTimeoutPreview(defaultTimeoutString(defaultTimeoutMs)),
    );
  }, [defaultTimeoutMs]);

  const onTimeoutInput: React.FormEventHandler<HTMLInputElement> = (e) => {
    setTimeoutPreviewText(formatPipelineTimeoutPreview(e.currentTarget.value));
  };

  return { timeoutPreviewText, onTimeoutInput };
};
