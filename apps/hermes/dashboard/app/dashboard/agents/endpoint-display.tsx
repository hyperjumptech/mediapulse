"use client";

/** Human-readable label for known endpoint keys. */
const ENDPOINT_KEY_LABELS: Record<string, string> = {
  url: "URL",
  method: "Method",
  headers: "Headers",
};

const ROW_CLASS =
  "flex items-center justify-between gap-8 py-4 px-6 sm:px-7 border-b border-border/60 last:border-b-0 first:pt-6 last:pb-6";
const LABEL_CLASS =
  "shrink-0 text-xs text-muted-foreground font-medium uppercase tracking-wide";
const VALUE_CLASS =
  "min-w-0 flex-1 text-sm font-mono text-foreground break-all font-normal text-right";

/**
 * Normalizes Prisma JsonValue to a plain record for display. Returns null if not a non-array object.
 *
 * @param value - Raw endpoint value from DB (JsonValue).
 * @returns Record of string keys to displayable values, or null.
 */
export const endpointToRecord = (
  value: unknown,
): Record<string, unknown> | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

/**
 * Formats a single value for display (string, number, boolean). Objects/arrays are JSON-stringified.
 *
 * @param v - Value to format.
 * @returns Display string.
 */
export const formatEndpointValue = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  return JSON.stringify(v);
};

type EndpointDisplayProps = {
  /** Endpoint JSON from agent registry (Prisma JsonValue). */
  endpoint: unknown;
};

/**
 * Renders agent endpoint as a key-value list (e.g. URL, Method) for admin readability.
 * Does not render raw JSON.
 */
export const EndpointDisplay = ({ endpoint }: EndpointDisplayProps) => {
  const record = endpointToRecord(endpoint);
  if (!record) {
    return (
      <p
        className="text-sm text-muted-foreground py-6 px-6 sm:px-7"
        data-testid="endpoint-empty"
      >
        No endpoint
      </p>
    );
  }

  const entries = Object.entries(record);
  if (entries.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground py-6 px-6 sm:px-7"
        data-testid="endpoint-empty"
      >
        No endpoint
      </p>
    );
  }

  return (
    <dl className="contents" data-testid="endpoint-display">
      {entries.map(([key, val]) => {
        const label = ENDPOINT_KEY_LABELS[key] ?? key;
        return (
          <div key={key} className={ROW_CLASS}>
            <span className={LABEL_CLASS}>{label}</span>
            <span className={VALUE_CLASS}>{formatEndpointValue(val)}</span>
          </div>
        );
      })}
    </dl>
  );
};
