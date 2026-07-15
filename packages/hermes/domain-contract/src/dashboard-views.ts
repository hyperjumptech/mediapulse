import { z } from "zod";

import { detailBlockSchema } from "./detail-blocks";

/** Where a dashboard view appears in the Hermes UI. */
export const dashboardViewPlacementSchema = z.enum(["sidebar", "agent-tab"]);

/** View kind — how Hermes renders domain-provided content. */
export const dashboardViewKindSchema = z.enum([
  "resource-table",
  "markdown",
  "html",
  "text",
]);

/** @deprecated Use {@link dashboardViewKindSchema} — accepts legacy `table-v1` during migration. */
export const dashboardTemplateSchema = z.enum(["table-v1", "resource-table"]);

/**
 * Schema for a column in a resource-table view.
 */
export const dashboardPageColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "date-time"]).default("text"),
});

/**
 * Schema for CRUD actions on a resource-table view.
 */
export const dashboardPageActionsSchema = z.object({
  create: z.boolean().default(false),
  update: z.boolean().default(false),
  delete: z.boolean().default(false),
  view: z.boolean().default(false),
});

export const dashboardPageCustomActionUiSchema = z.enum([
  "json-file-upload",
  "danger-confirm",
]);

export const dashboardPageCreateNavigationSchema = z
  .enum(["modal", "full-page"])
  .default("modal");

export const dashboardPagePreviewSchema = z.object({
  enabled: z.boolean(),
  fieldKey: z.string().min(1),
});

export const resourceTableDefaultSortSchema = z.object({
  sortBy: z.string().min(1),
  sortDir: z.enum(["asc", "desc"]),
});

/** @deprecated Use {@link resourceTableDefaultSortSchema}. */
export const tableV1DefaultSortSchema = resourceTableDefaultSortSchema;

export const resourceTableSelectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

/** @deprecated Use {@link resourceTableSelectOptionSchema}. */
export const tableV1SelectOptionSchema = resourceTableSelectOptionSchema;

export const resourceTableListFilterUiSchema = z.enum([
  "select",
  "boolean-select",
  "date-range",
]);

/** @deprecated Use {@link resourceTableListFilterUiSchema}. */
export const tableV1ListFilterUiSchema = resourceTableListFilterUiSchema;

export const resourceTableListFilterRangeParamsSchema = z.object({
  from: z.string().min(1).default("from"),
  to: z.string().min(1).default("to"),
});

/** @deprecated Use {@link resourceTableListFilterRangeParamsSchema}. */
export const tableV1ListFilterRangeParamsSchema =
  resourceTableListFilterRangeParamsSchema;

export const resourceTableListFilterDefinitionSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    ui: resourceTableListFilterUiSchema,
    placeholderAll: z.string().optional(),
    staticOptions: z.array(resourceTableSelectOptionSchema).optional(),
    optionsMetaKey: z.string().min(1).optional(),
    rangeParams: resourceTableListFilterRangeParamsSchema.optional(),
  })
  .superRefine((filter, ctx) => {
    if (
      filter.ui === "select" &&
      !filter.staticOptions &&
      !filter.optionsMetaKey
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "select filters require staticOptions or optionsMetaKey",
        path: ["optionsMetaKey"],
      });
    }
    if (filter.ui === "date-range" && !filter.rangeParams) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "date-range filters require rangeParams",
        path: ["rangeParams"],
      });
    }
  });

/** @deprecated Use {@link resourceTableListFilterDefinitionSchema}. */
export const tableV1ListFilterDefinitionSchema =
  resourceTableListFilterDefinitionSchema;

export const dashboardPageCustomActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  ui: dashboardPageCustomActionUiSchema,
  method: z.enum(["POST", "GET"]),
  path: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("/"), {
      message: "path must start with /",
    }),
  accept: z.string().optional(),
  confirmMessage: z.string().min(1).optional(),
  confirmToken: z.string().min(1).optional(),
});

/** Shared manifest fields for every dashboard view kind. */
export const dashboardViewBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().nonnegative().default(0),
  placement: dashboardViewPlacementSchema.default("sidebar"),
  apiPrefix: z.string().min(1),
  /** Required when `placement` is `sidebar`. */
  pathSegment: z.string().min(1).optional(),
  /** Tab label when `placement` is `agent-tab` (defaults to `label`). */
  tabLabel: z.string().min(1).optional(),
  /** When set, agent-tab views only appear for matching agent ids. */
  agentIds: z.array(z.string().min(1)).optional(),
});

export const resourceTableViewSchema = dashboardViewBaseSchema.extend({
  kind: z.literal("resource-table"),
  pathSegment: z.string().min(1),
  columns: z.array(dashboardPageColumnSchema).default([]),
  searchableFields: z.array(z.string().min(1)).default([]),
  sortableFields: z.array(z.string().min(1)).default([]),
  actions: dashboardPageActionsSchema.default({
    create: false,
    update: false,
    delete: false,
  }),
  createSchema: z.record(z.unknown()).optional(),
  updateSchema: z.record(z.unknown()).optional(),
  customActions: z.array(dashboardPageCustomActionSchema).default([]),
  createNavigation: dashboardPageCreateNavigationSchema,
  preview: dashboardPagePreviewSchema.optional(),
  detailBlocks: z.array(detailBlockSchema).optional(),
  defaultSort: resourceTableDefaultSortSchema.optional(),
  listFilters: z.array(resourceTableListFilterDefinitionSchema).optional(),
  /**
   * Field key on the detail row to use for the detail page header title. Defaults to the first
   * column's value when unset.
   */
  detailTitleField: z.string().min(1).optional(),
});

const contentViewKindSchema = z.enum(["markdown", "html", "text"]);

export const markdownViewSchema = dashboardViewBaseSchema.extend({
  kind: z.literal("markdown"),
});

export const htmlViewSchema = dashboardViewBaseSchema.extend({
  kind: z.literal("html"),
});

export const textViewSchema = dashboardViewBaseSchema.extend({
  kind: z.literal("text"),
});

export const contentViewResponseSchema = z.object({
  body: z.string(),
  title: z.string().optional(),
});

/**
 * Normalizes a legacy manifest page entry (`template: table-v1`) into a view.
 *
 * @param raw - Unknown manifest entry.
 * @returns Normalized view object for parsing.
 */
export const normalizeLegacyDashboardView = (
  raw: unknown,
): Record<string, unknown> | unknown => {
  if (typeof raw !== "object" || raw === null) {
    return raw;
  }
  const entry = { ...(raw as Record<string, unknown>) };
  if (entry.kind == null && entry.template != null) {
    const template = entry.template;
    if (template === "table-v1" || template === "resource-table") {
      entry.kind = "resource-table";
    }
    delete entry.template;
  }
  if (entry.placement == null) {
    entry.placement = "sidebar";
  }
  if (
    entry.kind === "resource-table" &&
    entry.pathSegment == null &&
    typeof entry.id === "string"
  ) {
    entry.pathSegment = entry.id;
  }
  if (
    contentViewKindSchema.safeParse(entry.kind).success &&
    entry.placement == null
  ) {
    entry.placement = "sidebar";
  }
  return entry;
};

/**
 * Validates placement-specific requirements on a parsed dashboard view.
 */
export const refineDashboardViewPlacement = (
  view: z.infer<typeof dashboardViewSchema>,
  ctx: z.RefinementCtx,
): void => {
  if (view.placement === "sidebar" && !view.pathSegment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "pathSegment is required when placement is sidebar",
      path: ["pathSegment"],
    });
  }
  if (view.kind === "resource-table" && !view.pathSegment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "pathSegment is required for resource-table views",
      path: ["pathSegment"],
    });
  }
};

export const dashboardViewSchema = z
  .discriminatedUnion("kind", [
    resourceTableViewSchema,
    markdownViewSchema,
    htmlViewSchema,
    textViewSchema,
  ])
  .superRefine((view, ctx) => {
    refineDashboardViewPlacement(view, ctx);
  });

/** @deprecated Use {@link resourceTableViewSchema} shape via {@link dashboardViewSchema}. */
export const dashboardPageSchema = resourceTableViewSchema;

/**
 * Parses a dashboard manifest, accepting legacy `pages` and `template: table-v1`.
 */
export const dashboardManifestSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }
    const obj = input as Record<string, unknown>;
    const rawViews = obj.views ?? obj.pages ?? [];
    const views = Array.isArray(rawViews)
      ? rawViews.map(normalizeLegacyDashboardView)
      : [];
    return {
      templateVersion: obj.templateVersion ?? 1,
      views,
    };
  },
  z.object({
    templateVersion: z.literal(1).default(1),
    views: z.array(dashboardViewSchema).default([]),
  }),
);

export const resourceTableListRequestQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(15),
  q: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

/** @deprecated Use {@link resourceTableListRequestQuerySchema}. */
export const tableV1ListRequestQuerySchema =
  resourceTableListRequestQuerySchema;

export const resourceTableListResponseSchema = z.object({
  items: z.array(z.record(z.unknown())),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

/** @deprecated Use {@link resourceTableListResponseSchema}. */
export const tableV1ListResponseSchema = resourceTableListResponseSchema;

export const resourceTableMetaResponseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  columns: z.array(dashboardPageColumnSchema),
  searchableFields: z.array(z.string().min(1)).default([]),
  sortableFields: z.array(z.string().min(1)).default([]),
  actions: dashboardPageActionsSchema,
  createSchema: z.record(z.unknown()).optional(),
  updateSchema: z.record(z.unknown()).optional(),
  customActions: z.array(dashboardPageCustomActionSchema).default([]),
  createNavigation: dashboardPageCreateNavigationSchema,
  preview: dashboardPagePreviewSchema.optional(),
  detailBlocks: z.array(detailBlockSchema).optional(),
  defaultSort: resourceTableDefaultSortSchema.optional(),
  listFilters: z.array(resourceTableListFilterDefinitionSchema).optional(),
  detailTitleField: z.string().min(1).optional(),
  filterOptions: z
    .record(z.string(), z.array(resourceTableSelectOptionSchema))
    .optional(),
});

/** @deprecated Use {@link resourceTableMetaResponseSchema}. */
export const tableV1MetaResponseSchema = resourceTableMetaResponseSchema;

export type DashboardViewPlacement = z.infer<
  typeof dashboardViewPlacementSchema
>;
export type DashboardViewKind = z.infer<typeof dashboardViewKindSchema>;
export type DashboardView = z.infer<typeof dashboardViewSchema>;
export type ResourceTableView = z.infer<typeof resourceTableViewSchema>;
export type MarkdownView = z.infer<typeof markdownViewSchema>;
export type HtmlView = z.infer<typeof htmlViewSchema>;
export type TextView = z.infer<typeof textViewSchema>;
export type ContentViewResponse = z.infer<typeof contentViewResponseSchema>;
export type DashboardManifest = z.infer<typeof dashboardManifestSchema>;
/** @deprecated Use {@link ResourceTableView}. */
export type DashboardPage = ResourceTableView;
/** @deprecated Use {@link ResourceTableView} input. */
export type DashboardPageInput = z.input<typeof resourceTableViewSchema>;
/** @deprecated Use {@link DashboardView} input. */
export type DashboardViewInput = z.input<typeof dashboardViewSchema>;
export type ResourceTableListRequestQuery = z.infer<
  typeof resourceTableListRequestQuerySchema
>;
export type ResourceTableListResponse = z.infer<
  typeof resourceTableListResponseSchema
>;
export type ResourceTableMetaResponse = z.infer<
  typeof resourceTableMetaResponseSchema
>;
/** @deprecated Use {@link ResourceTableListRequestQuery}. */
export type TableV1ListRequestQuery = ResourceTableListRequestQuery;
/** @deprecated Use {@link ResourceTableListResponse}. */
export type TableV1ListResponse = ResourceTableListResponse;
/** @deprecated Use {@link ResourceTableMetaResponse}. */
export type TableV1MetaResponse = ResourceTableMetaResponse;
export type ResourceTableDefaultSort = z.infer<
  typeof resourceTableDefaultSortSchema
>;
export type ResourceTableSelectOption = z.infer<
  typeof resourceTableSelectOptionSchema
>;
export type ResourceTableListFilterUi = z.infer<
  typeof resourceTableListFilterUiSchema
>;
export type ResourceTableListFilterRangeParams = z.infer<
  typeof resourceTableListFilterRangeParamsSchema
>;
export type ResourceTableListFilterDefinition = z.infer<
  typeof resourceTableListFilterDefinitionSchema
>;
/** @deprecated Use {@link ResourceTableDefaultSort}. */
export type TableV1DefaultSort = ResourceTableDefaultSort;
/** @deprecated Use {@link ResourceTableSelectOption}. */
export type TableV1SelectOption = ResourceTableSelectOption;
/** @deprecated Use {@link ResourceTableListFilterUi}. */
export type TableV1ListFilterUi = ResourceTableListFilterUi;
/** @deprecated Use {@link ResourceTableListFilterRangeParams}. */
export type TableV1ListFilterRangeParams = ResourceTableListFilterRangeParams;
/** @deprecated Use {@link ResourceTableListFilterDefinition}. */
export type TableV1ListFilterDefinition = ResourceTableListFilterDefinition;
