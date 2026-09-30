import { z } from "zod";

import type { HermesHttpMethod } from "./http-client.js";
import type { HermesToolset } from "./toolsets.js";

export type HermesReadToolSpec = {
  name: string;
  title: string;
  description: string;
  toolset: HermesToolset;
  method: HermesHttpMethod;
  pathTemplate: string;
  inputSchema: z.ZodRawShape;
  queryKeys?: readonly string[];
  filtersArgument?: string;
  sortFields?: readonly string[];
  paginated?: boolean;
};

type SortFields = readonly [string, ...string[]];

type ListQueryOptions = {
  searchHint: string;
  sortFields?: SortFields;
  defaultSort?: string;
};

export const MAX_LIST_PAGE_SIZE = 100;

export const LIST_QUERY_KEYS = [
  "page",
  "pageSize",
  "q",
  "sort",
  "dir",
] as const;

export const PAGE_QUERY_KEYS = ["page", "pageSize"] as const;

const pageQueryShape = (defaultPageSize: number): z.ZodRawShape => ({
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based page number. Default 1."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIST_PAGE_SIZE)
    .optional()
    .describe(
      `Rows per page, 1 to ${MAX_LIST_PAGE_SIZE}. Default ${defaultPageSize}.`,
    ),
});

export const pagedToolSpec = (
  spec: Omit<
    HermesReadToolSpec,
    "method" | "queryKeys" | "sortFields" | "paginated"
  > & {
    filterQueryKeys?: readonly string[];
    defaultPageSize?: number;
  },
): HermesReadToolSpec => ({
  name: spec.name,
  title: spec.title,
  description: spec.description,
  toolset: spec.toolset,
  method: "GET",
  pathTemplate: spec.pathTemplate,
  inputSchema: {
    ...spec.inputSchema,
    ...pageQueryShape(spec.defaultPageSize ?? 20),
  },
  queryKeys: [...PAGE_QUERY_KEYS, ...(spec.filterQueryKeys ?? [])],
  paginated: true,
});

export const listQueryShape = ({
  searchHint,
  sortFields,
  defaultSort,
}: ListQueryOptions): z.ZodRawShape => {
  const sortDescription = defaultSort
    ? `Sort field. Default: ${defaultSort}.`
    : "Sort field.";
  const sort = sortFields
    ? z.enum(sortFields).optional().describe(sortDescription)
    : z
        .string()
        .min(1)
        .optional()
        .describe(
          "Sort field. Must be one of the view's sortableFields from hermes_list_domain_views.",
        );

  return {
    page: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("1-based page number. Default 1."),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIST_PAGE_SIZE)
      .optional()
      .describe(`Rows per page, 1 to ${MAX_LIST_PAGE_SIZE}. Default 20.`),
    q: z
      .string()
      .max(200)
      .optional()
      .describe(`Case-insensitive search on ${searchHint}.`),
    sort,
    dir: z.enum(["asc", "desc"]).optional().describe("Sort direction."),
  };
};

export const listToolSpec = (
  spec: Omit<
    HermesReadToolSpec,
    "method" | "inputSchema" | "queryKeys" | "sortFields" | "paginated"
  > &
    ListQueryOptions & { sortFields: SortFields },
): HermesReadToolSpec => ({
  name: spec.name,
  title: spec.title,
  description: spec.description,
  toolset: spec.toolset,
  method: "GET",
  pathTemplate: spec.pathTemplate,
  inputSchema: listQueryShape(spec),
  queryKeys: LIST_QUERY_KEYS,
  sortFields: spec.sortFields,
  paginated: true,
});

export const guidField = (description: string) =>
  z.guid().describe(description);

export const nonEmptyStringField = (description: string) =>
  z.string().min(1).describe(description);
