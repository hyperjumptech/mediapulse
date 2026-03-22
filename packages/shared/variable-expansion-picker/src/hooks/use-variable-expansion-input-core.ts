import * as React from "react";

import { insertAtRange } from "../lib/insert-at-range";

export type VariableExpansionInputCore = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  insert: (text: string) => void;
};

/**
 * Holds the input ref and insert callback: inserts at selection/cursor and calls onChange.
 *
 * @param value - Current controlled value.
 * @param onChange - Called with the next string after insert.
 * @returns Ref and insert function.
 */
export const useVariableExpansionInputCore = (
  value: string,
  onChange: (value: string) => void,
): VariableExpansionInputCore => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const insert = React.useCallback(
    (text: string) => {
      const input = inputRef.current;
      const start = input?.selectionStart ?? value.length;
      const end = input?.selectionEnd ?? value.length;
      const next = insertAtRange(value, start, end, text);
      onChange(next);
      requestAnimationFrame(() => {
        input?.focus();
        const pos = start + text.length;
        input?.setSelectionRange(pos, pos);
      });
    },
    [value, onChange],
  );

  return { inputRef, insert };
};
