"use client";

/** Human-readable label for known endpoint keys. */
const ENDPOINT_KEY_LABELS: Record<string, string> = {
  url: "URL",
  method: "Method",
  headers: "Headers",
};

const ROW_CLASS =
  "grid gap-1 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4";
const LABEL_CLASS = "text-xs text-muted-foreground sm:pt-0.5";
const VALUE_CLASS = "min-w-0 font-mono text-sm break-all text-foreground";

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
        className="px-4 py-6 text-sm text-muted-foreground"
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
        className="px-4 py-6 text-sm text-muted-foreground"
        data-testid="endpoint-empty"
      >
        No endpoint
      </p>
    );
  }

  return (
    <dl data-testid="endpoint-display">
      {entries.map(([key, entryValue]) => {
        const label = ENDPOINT_KEY_LABELS[key] ?? key;
        const displayValue = formatEndpointValue(entryValue);

        return (
          <div key={key} className={ROW_CLASS}>
            <dt className={LABEL_CLASS}>{label}</dt>
            <dd className={VALUE_CLASS}>{displayValue}</dd>
          </div>
        );
      })}
    </dl>
  );
};
