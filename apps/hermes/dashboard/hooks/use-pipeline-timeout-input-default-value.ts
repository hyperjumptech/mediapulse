import { useMemo } from "react";

/**
 * Derives the initial `defaultValue` string for the uncontrolled pipeline agent-timeout input.
 *
 * @param defaultTimeoutMs - Optional per-invocation timeout in milliseconds from the server.
 * @returns Empty string when unset or non-positive; otherwise the stringified positive number.
 */
export const usePipelineTimeoutInputDefaultValue = (
  defaultTimeoutMs?: number,
): string =>
  useMemo(
    () =>
      defaultTimeoutMs != null && defaultTimeoutMs > 0
        ? String(defaultTimeoutMs)
        : "",
    [defaultTimeoutMs],
  );
