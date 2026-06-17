/** One structured log entry included in the Hermes invoke envelope. */
export type AgentRunLogEntry = {
  level: string;
  message: string;
  context?: Record<string, unknown>;
};

export type RunLogBuffer = {
  /** Appends a log entry; drops oldest when over capacity. */
  append: (entry: AgentRunLogEntry) => void;
  /** Returns a snapshot of collected entries for the envelope. */
  toArray: () => AgentRunLogEntry[];
};

const DEFAULT_MAX_ENTRIES = 400;

/**
 * Collects structured log entries agents can attach to the Hermes invoke envelope.
 *
 * @param maxEntries - Maximum entries retained (default 400, matching scheduler limit).
 * @returns Buffer with `append` and `toArray`.
 */
export const createRunLogBuffer = (
  maxEntries: number = DEFAULT_MAX_ENTRIES,
): RunLogBuffer => {
  const entries: AgentRunLogEntry[] = [];

  return {
    append: (entry: AgentRunLogEntry) => {
      entries.push(entry);
      if (entries.length > maxEntries) {
        entries.shift();
      }
    },
    toArray: () => [...entries],
  };
};
