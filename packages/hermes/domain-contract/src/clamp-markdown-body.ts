/** Result of clamping a markdown body for the `markdown` detail block. */
export type ClampMarkdownBodyResult = {
  /** The visible text — either the original body or the clamped prefix. */
  visible: string;
  /** Whether the body was clamped and a "show full" expander should appear. */
  clamped: boolean;
  /** Length (in characters) of the original body, useful for telemetry. */
  originalLength: number;
};

/**
 * Clamps a markdown body to a prefix when it exceeds the threshold.
 * Returns the original body unchanged when no clamping is needed.
 *
 * `clampChars` is the prefix length used when clamping. `clampThreshold` is the
 * cutoff above which clamping engages (defaults to `clampChars * 2`).
 *
 * @param body - Source markdown text.
 * @param options - `clampChars` (required) and optional `clampThreshold`.
 * @returns Visible text plus a `clamped` flag.
 */
export function clampMarkdownBody(
  body: string,
  options: { clampChars: number; clampThreshold?: number },
): ClampMarkdownBodyResult {
  const { clampChars } = options;
  if (clampChars <= 0) {
    return { visible: body, clamped: false, originalLength: body.length };
  }
  const threshold = options.clampThreshold ?? clampChars * 2;
  if (body.length <= threshold) {
    return { visible: body, clamped: false, originalLength: body.length };
  }
  return {
    visible: body.slice(0, clampChars),
    clamped: true,
    originalLength: body.length,
  };
}
