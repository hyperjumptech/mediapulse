import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { HermesHttpResponse } from "./http-client.js";

export const MAX_TOOL_TEXT_CHARACTERS = 50_000;

export const PAGINATED_LIST_OUTPUT_SHAPE = {
  items: z.array(z.record(z.string(), z.unknown())),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
  truncated: z.boolean().optional(),
};

const paginatedListSchema = z.object(PAGINATED_LIST_OUTPUT_SHAPE);

export type PaginatedListResult = z.infer<typeof paginatedListSchema>;

export type FormatToolResultOptions = {
  maxCharacters?: number;
};

const NARROW_QUERY_HINT =
  "Narrow the query with a smaller pageSize, a q search, or a hermes_get_* tool for one record.";

const isErrorStatus = (status: number): boolean =>
  status === 0 || status >= 400;

const serializeJson = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value) ?? "null";
};

const textResult = (text: string, isError: boolean): CallToolResult =>
  isError
    ? { content: [{ type: "text", text }], isError: true }
    : { content: [{ type: "text", text }] };

export const capToolText = (
  text: string,
  maxCharacters: number = MAX_TOOL_TEXT_CHARACTERS,
): string => {
  if (text.length <= maxCharacters) {
    return text;
  }

  const note = `[Truncated at ${maxCharacters} of ${text.length} characters. ${NARROW_QUERY_HINT}]`;
  const keptLength = Math.max(0, maxCharacters - note.length - 1);

  return `${text.slice(0, keptLength)}\n${note}`;
};

export const formatJsonToolResult = (
  value: unknown,
  {
    isError = false,
    maxCharacters,
  }: FormatToolResultOptions & {
    isError?: boolean;
  } = {},
): CallToolResult => {
  const text = capToolText(serializeJson(value), maxCharacters);

  return textResult(text, isError);
};

const formatHttpErrorResult = (
  response: HermesHttpResponse,
  maxCharacters: number | undefined,
): CallToolResult =>
  formatJsonToolResult(
    { status: response.status, body: response.body },
    { isError: true, maxCharacters },
  );

export const formatHermesHttpAsToolResult = (
  response: HermesHttpResponse,
  { maxCharacters }: FormatToolResultOptions = {},
): CallToolResult => {
  if (isErrorStatus(response.status)) {
    return formatHttpErrorResult(response, maxCharacters);
  }

  return formatJsonToolResult(response.body, { maxCharacters });
};

export const parsePaginatedListBody = (
  body: unknown,
): PaginatedListResult | undefined => {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const total = record.total;
  const page = record.page;
  const pageSize = record.pageSize;
  const derivedHasMore =
    typeof total === "number" &&
    typeof page === "number" &&
    typeof pageSize === "number" &&
    page * pageSize < total;
  const hasMore =
    typeof record.hasMore === "boolean" ? record.hasMore : derivedHasMore;
  const parsed = paginatedListSchema.safeParse({
    items: record.items,
    total,
    page,
    pageSize,
    hasMore,
  });

  return parsed.success ? parsed.data : undefined;
};

const fitListToCharacterLimit = (
  list: PaginatedListResult,
  maxCharacters: number,
): { list: PaginatedListResult; text: string } => {
  const fullText = JSON.stringify(list);
  if (fullText.length <= maxCharacters) {
    return { list, text: fullText };
  }

  const buildNote = (shownCount: number) =>
    `[Truncated: showing ${shownCount} of ${list.items.length} items on this page to stay under ${maxCharacters} characters. ${NARROW_QUERY_HINT}]`;
  const longestNoteLength = buildNote(list.items.length).length;
  const envelopeLength = JSON.stringify({
    ...list,
    items: [],
    truncated: true,
  }).length;
  const budget = maxCharacters - longestNoteLength - 1;
  let usedLength = envelopeLength;
  let shownCount = 0;
  for (const item of list.items) {
    const separatorLength = shownCount === 0 ? 0 : 1;
    const itemLength = JSON.stringify(item).length + separatorLength;
    if (usedLength + itemLength > budget) {
      break;
    }
    usedLength += itemLength;
    shownCount += 1;
  }

  const truncatedList: PaginatedListResult = {
    ...list,
    items: list.items.slice(0, shownCount),
    truncated: true,
  };
  const text = `${JSON.stringify(truncatedList)}\n${buildNote(shownCount)}`;

  return { list: truncatedList, text };
};

export const formatHermesListAsToolResult = (
  response: HermesHttpResponse,
  { maxCharacters = MAX_TOOL_TEXT_CHARACTERS }: FormatToolResultOptions = {},
): CallToolResult => {
  if (isErrorStatus(response.status)) {
    return formatHttpErrorResult(response, maxCharacters);
  }

  const list = parsePaginatedListBody(response.body);
  if (!list) {
    return formatJsonToolResult(
      {
        error: "Hermes returned a response that is not a paginated list",
        status: response.status,
        body: response.body,
      },
      { isError: true, maxCharacters },
    );
  }

  const fitted = fitListToCharacterLimit(list, maxCharacters);

  return {
    content: [{ type: "text", text: fitted.text }],
    structuredContent: fitted.list,
  };
};

export const formatHermesToolError = (
  message: string,
  details?: unknown,
): CallToolResult => {
  const payload =
    details === undefined ? { error: message } : { error: message, details };

  return formatJsonToolResult(payload, { isError: true });
};
