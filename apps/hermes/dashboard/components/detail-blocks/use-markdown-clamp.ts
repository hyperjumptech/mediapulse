"use client";

import { useState } from "react";

/** Visible markdown text plus a `clamped` flag. */
export type ClampedMarkdownState = {
  visible: string;
  clamped: boolean;
};

/** State + handlers for the "show full" expander on a clamped markdown block. */
export type UseMarkdownClampReturn = {
  /** Current visible body (clamped prefix or full). */
  text: string;
  /** Whether the "show full" expander should be visible. */
  showExpander: boolean;
  /** Whether the body is currently expanded. */
  expanded: boolean;
  /** Toggles between clamped and full views. */
  toggle: () => void;
};

/**
 * Manages clamp/expand state for the markdown detail block.
 *
 * @param fullText - Full markdown body.
 * @param clampedState - Output of `clampMarkdownBody`.
 * @returns Visible text plus expander handlers.
 */
export const useMarkdownClamp = (
  fullText: string,
  clampedState: ClampedMarkdownState,
): UseMarkdownClampReturn => {
  const [expanded, setExpanded] = useState(false);
  const showExpander = clampedState.clamped;
  const text =
    expanded || !clampedState.clamped ? fullText : clampedState.visible;
  const toggle = () => setExpanded((value) => !value);
  return { text, showExpander, expanded, toggle };
};
