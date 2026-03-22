"use client";

type JsonPrettyProps = {
  /** Value to render as pretty-printed JSON (e.g. inputSchema or configSchema). */
  value: unknown;
  /** Optional title above the JSON block. */
  title?: string;
};

/**
 * Renders a value as pretty-printed JSON in a scrollable code block.
 * Shows "No schema" for null/undefined; otherwise uses JSON.stringify with 2-space indent.
 */
export const JsonPretty = ({ value, title }: JsonPrettyProps) => {
  if (value === null || value === undefined) {
    return (
      <div data-testid="json-pretty-empty">
        {title ? (
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">No schema</p>
      </div>
    );
  }

  const jsonString = JSON.stringify(value, null, 2);

  return (
    <div data-testid="json-pretty" className="space-y-2">
      {title ? (
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      ) : null}
      <div className="h-[400px] w-full overflow-auto rounded-lg border border-border/50 bg-muted/25">
        <pre className="p-4 font-mono text-sm text-foreground whitespace-pre">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};
