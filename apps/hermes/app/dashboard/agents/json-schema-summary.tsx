"use client";

import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

/** JSON Schema property sub-schema (type, etc.). */
type PropertySchema = Record<string, unknown>;

/**
 * Returns true if value is a non-array object (possible JSON Schema object).
 *
 * @param v - Value to check.
 * @returns True if object.
 */
export const isSchemaObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Extracts top-level type from a JSON Schema object (type field or "object" default).
 *
 * @param schema - JSON Schema object.
 * @returns Type string for display.
 */
export const getSchemaType = (schema: Record<string, unknown>): string => {
  const t = schema.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return (t as string[]).join(" | ");
  return "object";
};

/**
 * Extracts required array from a JSON Schema object.
 *
 * @param schema - JSON Schema object.
 * @returns Array of required property names.
 */
export const getRequiredProperties = (
  schema: Record<string, unknown>,
): string[] => {
  const r = schema.required;
  if (!Array.isArray(r)) return [];
  return r.filter((x): x is string => typeof x === "string");
};

/**
 * Extracts properties map from a JSON Schema object.
 *
 * @param schema - JSON Schema object.
 * @returns Record of property name to sub-schema, or empty object.
 */
export const getProperties = (
  schema: Record<string, unknown>,
): Record<string, PropertySchema> => {
  const p = schema.properties;
  if (!isSchemaObject(p)) return {};
  return p as Record<string, PropertySchema>;
};

/**
 * Describes a property's type for display (string, number, object, etc.).
 *
 * @param propSchema - Property's schema object.
 * @returns Short type description.
 */
export const getPropertyTypeLabel = (propSchema: PropertySchema): string => {
  const t = propSchema.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return (t as string[]).join(" | ");
  if (isSchemaObject(propSchema.properties)) {
    const keys = Object.keys(propSchema.properties);
    return keys.length === 0 ? "object" : `object (${keys.length} properties)`;
  }
  return "unknown";
};

type JsonSchemaSummaryProps = {
  /** JSON Schema object from agent registry (inputSchema or configSchema). */
  schema: unknown;
  /** Optional title above the summary (e.g. "Input schema"). */
  title?: string;
};

/**
 * Renders a JSON Schema object as a summary: type, required fields, and properties table.
 * Does not render raw JSON. Shows "No schema" or "Invalid schema" for null/invalid values.
 */
export const JsonSchemaSummary = ({
  schema,
  title,
}: JsonSchemaSummaryProps) => {
  if (schema === null || schema === undefined) {
    return (
      <div data-testid="schema-summary-empty">
        {title ? (
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">No schema</p>
      </div>
    );
  }

  if (!isSchemaObject(schema)) {
    return (
      <div data-testid="schema-summary-invalid">
        {title ? (
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">Invalid schema</p>
      </div>
    );
  }

  const typeLabel = getSchemaType(schema);
  const required = getRequiredProperties(schema);
  const properties = getProperties(schema);
  const propEntries = Object.entries(properties);

  return (
    <div className="space-y-4" data-testid="schema-summary">
      {title ? (
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">
          {title}
        </h3>
      ) : null}
      <div className="rounded-lg bg-muted/25 border border-border/50 overflow-hidden px-6 sm:px-7 py-6 space-y-6">
        <div className="flex items-center justify-between gap-8 px-0">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide shrink-0">
            Type
          </span>
          <span className="font-medium text-foreground text-right">
            {typeLabel}
          </span>
        </div>
        {propEntries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-[160px] text-xs text-muted-foreground font-medium h-10 px-0 pt-2 pb-3">
                  Property
                </TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium h-10 px-0 pt-2 pb-3 text-right">
                  Type
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propEntries.map(([name, propSchema]) => (
                <TableRow
                  key={name}
                  className="border-border/60 hover:bg-transparent"
                >
                  <TableCell className="align-middle py-3 font-medium px-0">
                    <span className="inline-flex items-center gap-1.5">
                      {name}
                      {required.includes(name) ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal px-1.5 py-0 leading-tight"
                        >
                          required
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="align-middle text-muted-foreground font-mono text-sm py-3 px-0 text-right">
                    {getPropertyTypeLabel(propSchema)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p
            className="text-sm text-muted-foreground pt-2 pb-1"
            data-testid="schema-no-properties"
          >
            No properties
          </p>
        )}
      </div>
    </div>
  );
};
