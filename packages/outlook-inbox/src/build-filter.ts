import type { MessageFilter } from "./types.js";

/**
 * Builds an OData $filter string for Microsoft Graph messages from a MessageFilter.
 * Escapes single quotes in string values and combines criteria with AND.
 *
 * @param filter - Filter criteria; empty or all-undefined returns empty string.
 * @returns OData filter string (e.g. "receivedDateTime ge 2024-01-01T00:00:00Z and isRead eq false") or "".
 */
export function buildFilter(filter: MessageFilter): string {
  const parts: string[] = [];

  if (filter.subjectEquals !== undefined && filter.subjectEquals !== "") {
    parts.push(`subject eq ${escapeODataString(filter.subjectEquals)}`);
  }
  if (filter.subjectContains !== undefined && filter.subjectContains !== "") {
    parts.push(
      `contains(subject,${escapeODataString(filter.subjectContains)})`,
    );
  }
  if (filter.receivedAfter !== undefined) {
    parts.push(`receivedDateTime ge ${toODataDateTime(filter.receivedAfter)}`);
  }
  if (filter.receivedBefore !== undefined) {
    parts.push(`receivedDateTime le ${toODataDateTime(filter.receivedBefore)}`);
  }
  if (filter.isUnread === true) {
    parts.push("isRead eq false");
  }
  if (filter.isUnread === false) {
    parts.push("isRead eq true");
  }

  return parts.length === 0 ? "" : parts.join(" and ");
}

/**
 * Escapes a string for use in OData: wraps in single quotes and doubles internal quotes.
 */
function escapeODataString(value: string): string {
  const escaped = value.replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Converts a Date to OData datetime string (ISO 8601).
 */
function toODataDateTime(d: Date): string {
  return d.toISOString();
}
