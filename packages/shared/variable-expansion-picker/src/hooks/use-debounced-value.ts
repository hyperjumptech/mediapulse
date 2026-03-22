import * as React from "react";

/**
 * Returns a value that updates to `value` after `delayMs` of stability.
 *
 * @param value - Source value (e.g. controlled search input).
 * @param delayMs - Debounce delay in milliseconds.
 * @returns Debounced copy of `value`.
 */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [value, delayMs]);

  return debounced;
};
