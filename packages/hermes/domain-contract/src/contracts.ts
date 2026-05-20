import { z } from "zod";

import { detailBlockSchema } from "./detail-blocks";

/**
 * Capabilities supported by the domain integration. Currently only `expand-step-inputs` and `preview-expansion` are supported.
 */
export const domainIntegrationCapabilitySchema = z.enum([
  "expand-step-inputs",
  "preview-expansion",
]);

/**
 * Template type for a Hermes dashboard page. Currently only `table-v1` is supported.
 */
export const dashboardTemplateSchema = z.enum(["table-v1"]);

/**
 * Schema for a column in a Hermes dashboard page. A column basically needs a key, label, and type.
 */
export const dashboardPageColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "date-time"]).default("text"),
});

/**
 * Schema for the actions on a Hermes dashboard page (create/update/delete plus optional read-only row detail).
 */
export const dashboardPageActionsSchema = z.object({
  create: z.boolean().default(false),
  update: z.boolean().default(false),
  delete: z.boolean().default(false),
  /** When true, Hermes may link each row to a read-only detail page (`GET {apiPrefix}/{id}`). */
  view: z.boolean().default(false),
});

/**
 * Metadata for an optional custom action (e.g. bulk import) registered on a dashboard page.
 */
export const dashboardPageCustomActionUiSchema = z.enum([
  "json-file-upload",
  "danger-confirm",
]);

/** How Hermes opens create/edit flows for a table-v1 page. */
export const dashboardPageCreateNavigationSchema = z
  .enum(["modal", "full-page"])
  .default("modal");

/**
 * When `enabled`, Hermes may show a preview control for the given form `fieldKey`
 * if the integration also registers the `preview-expansion` capability.
 */
export const dashboardPagePreviewSchema = z.object({
  enabled: z.boolean(),
  fieldKey: z.string().min(1),
});

/**
 * Schema for a custom action registered on a dashboard page. For example, a bulk import action.
 */
export const dashboardPageCustomActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  ui: dashboardPageCustomActionUiSchema,
  method: z.enum(["POST", "GET"]),
  /** Path suffix appended to the page `apiPrefix` (must start with `/`, e.g. `/import-idx-json`). */
  path: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("/"), {
      message: "path must start with /",
    }),
  /** Optional `accept` attribute for file inputs (e.g. `.json,application/json`). */
  accept: z.string().optional(),
  /** Shown in a browser confirm dialog before POST (danger-confirm UI). */
  confirmMessage: z.string().min(1).optional(),
  /** Literal value the client must send as `confirm` in the POST JSON body. */
  confirmToken: z.string().min(1).optional(),
});

/**
 * Builds a JSON Schema `type: "object"` fragment for Hermes table-v1 create/update forms.
 * Ensures each `required` entry is a key on `properties` so typos fail at compile time.
 *
 * @param schema - Object schema with `properties` and optional `required` key list
 * @returns The same object widened for {@link dashboardPageSchema} `createSchema` / `updateSchema` input
 */
export function dashboardObjectFormJsonSchema<
  const P extends Record<string, unknown>,
>(schema: {
  type: "object";
  required?: ReadonlyArray<Extract<keyof P, string>>;
  properties: P;
}): Record<string, unknown> {
  return schema;
}

/**
 * When used as `properties` on a form schema, rejects keys that are not present on the table list row type.
 *
 * @typeParam P - JSON Schema `properties` object
 * @typeParam ListRow - List item from the domain API (same shape as {@link columnsFor} `Row`)
 */
export type DashboardFormPropertiesMustMatchListRowKeys<
  P extends Record<string, unknown>,
  ListRow extends Record<string, unknown>,
> = [Exclude<keyof P, keyof ListRow>] extends [never] ? P : never;

/**
 * Like {@link dashboardObjectFormJsonSchema}, but every `properties` key must exist on `ListRow`
 * (the JSON shape returned by the resource list mapper). Pass the same type as `columnsFor<ListRow>` uses
 * so create/update forms cannot drift from list columns.
 *
 * @typeParam ListRow - List item record (e.g. `ListItem` from the resource `list-mapper`).
 * @returns Curried builder: call as `dashboardObjectFormJsonSchemaForListRow<ListItem>()({ type: "object", ... })`
 *   (same ergonomics as {@link columnsFor} so `ListRow` is fixed first, then `properties` infers `P`).
 */
export const dashboardObjectFormJsonSchemaForListRow =
  <ListRow extends Record<string, unknown>>() =>
  <const P extends Record<string, unknown>>(schema: {
    type: "object";
    required?: ReadonlyArray<Extract<keyof P, string>>;
    properties: DashboardFormPropertiesMustMatchListRowKeys<P, ListRow>;
  }): Record<string, unknown> =>
    schema;

export const dashboardPageSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().nonnegative().default(0),
  pathSegment: z.string().min(1),
  template: dashboardTemplateSchema,
  apiPrefix: z.string().min(1),
  columns: z.array(dashboardPageColumnSchema).default([]),
  searchableFields: z.array(z.string().min(1)).default([]),
  sortableFields: z.array(z.string().min(1)).default([]),
  actions: dashboardPageActionsSchema.default({
    create: false,
    update: false,
    delete: false,
  }),
  /**
   * JSON Schema for the create form. Hermes table-v1 parses a subset: `type: "object"` with
   * `properties` where each property may use `type` string (optional `format`: `date-time`, `textarea`),
   * number, integer, boolean, string `enum`, nested `object` with its own `properties` (dot-joined field
   * names in forms), or optional `nullable` / `anyOf` with `{ type: "null" }`.
   */
  createSchema: z.record(z.unknown()).optional(),
  /**
   * Same shape as `createSchema` for the edit form payload (PATCH body fields).
   */
  updateSchema: z.record(z.unknown()).optional(),
  customActions: z.array(dashboardPageCustomActionSchema).default([]),
  createNavigation: dashboardPageCreateNavigationSchema,
  preview: dashboardPagePreviewSchema.optional(),
  /**
   * Optional list of detail blocks rendered on the read-only detail page in order.
   * When omitted, the detail page falls back to its built-in key/value rendering.
   */
  detailBlocks: z.array(detailBlockSchema).optional(),
});

/**
 * Schema for a Hermes dashboard manifest.
 */
export const dashboardManifestSchema = z.object({
  /**
   * Version of the dashboard manifest template. Currently only 1 is supported.
   */
  templateVersion: z.literal(1).default(1),
  /**
   * List of pages in the dashboard manifest.
   */
  pages: z.array(dashboardPageSchema).default([]),
});

/**
 * Schema for the query parameters for a list request to a Hermes dashboard page.
 */
export const tableV1ListRequestQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(15),
  q: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

/**
 * Schema for the response from a list request to a Hermes dashboard page.
 */
export const tableV1ListResponseSchema = z.object({
  items: z.array(z.record(z.unknown())),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

/**
 * Schema for the response from a meta request to a Hermes dashboard page.
 */
export const tableV1MetaResponseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  columns: z.array(dashboardPageColumnSchema),
  searchableFields: z.array(z.string().min(1)).default([]),
  sortableFields: z.array(z.string().min(1)).default([]),
  actions: dashboardPageActionsSchema,
  /**
   * Echoed from the manifest for Hermes to build create/edit modals (see `dashboardPageSchema.createSchema`).
   */
  createSchema: z.record(z.unknown()).optional(),
  /**
   * Echoed from the manifest for Hermes to build edit modals (see `dashboardPageSchema.updateSchema`).
   */
  updateSchema: z.record(z.unknown()).optional(),
  customActions: z.array(dashboardPageCustomActionSchema).default([]),
  createNavigation: dashboardPageCreateNavigationSchema,
  preview: dashboardPagePreviewSchema.optional(),
  /**
   * Optional list of detail blocks rendered on the read-only detail page (echoed
   * from {@link dashboardPageSchema} so Hermes can render the detail view from meta).
   */
  detailBlocks: z.array(detailBlockSchema).optional(),
});

/**
 * Schema for a request to register a domain integration.
 */
export const registerDomainIntegrationRequestSchema = z.object({
  /** Stable public identifier (not the integration API secret). */
  integrationId: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  version: z.string().optional(),
  capabilities: z.array(domainIntegrationCapabilitySchema).default([]),
  dashboard: dashboardManifestSchema.default({
    templateVersion: 1,
    pages: [],
  }),
});

/**
 * Schema for a response from a request to register a domain integration.
 */
export const registerDomainIntegrationResponseSchema = z.object({
  id: z.string().uuid(),
  integrationId: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  version: z.string().nullable(),
  capabilities: z.array(domainIntegrationCapabilitySchema),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  dashboard: dashboardManifestSchema,
});

/**
 * Schema for a response from a health check request to a domain integration.
 */
export const domainHealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string().min(1),
  version: z.string().optional(),
});

/**
 * Schema for a request to preview an expansion.
 */
export const previewExpansionRequestSchema = z.object({
  expansionString: z.string().min(1),
});

/**
 * Schema for a response from a preview expansion request.
 */
export const previewExpansionResponseSchema = z.union([
  z.object({
    success: z.literal(true),
    values: z.array(z.unknown()),
  }),
  z.object({
    success: z.literal(false),
    error: z.string().min(1),
  }),
]);

/**
 * Schema for a request to expand step inputs.
 */
export const expandStepInputsRequestSchema = z.object({
  input: z.record(z.unknown()),
  maxTake: z.number().int().nonnegative().optional(),
  defaultTake: z.number().int().nonnegative().optional(),
});

/**
 * Schema for a response from a request to expand step inputs.
 */
export const expandStepInputsResponseSchema = z.object({
  expandedInputs: z.array(z.record(z.unknown())),
});

/**
 * Type for a request to register a domain integration.
 */
export type RegisterDomainIntegrationRequest = z.infer<
  typeof registerDomainIntegrationRequestSchema
>;
/**
 * Type for a response from a request to register a domain integration.
 */
export type RegisterDomainIntegrationResponse = z.infer<
  typeof registerDomainIntegrationResponseSchema
>;
/**
 * Type for a Hermes dashboard manifest.
 */
export type DashboardManifest = z.infer<typeof dashboardManifestSchema>;
export type DashboardPage = z.infer<typeof dashboardPageSchema>;
/**
 * Input object for {@link dashboardPageSchema} (before defaults and coercion).
 * Use with `satisfies` so manifest pages are checked against the contract at compile time.
 */
export type DashboardPageInput = z.input<typeof dashboardPageSchema>;
export type TableV1ListRequestQuery = z.infer<
  typeof tableV1ListRequestQuerySchema
>;
export type TableV1ListResponse = z.infer<typeof tableV1ListResponseSchema>;
export type TableV1MetaResponse = z.infer<typeof tableV1MetaResponseSchema>;
export type DashboardPageCustomAction = z.infer<
  typeof dashboardPageCustomActionSchema
>;
export type DashboardPageCreateNavigation = z.infer<
  typeof dashboardPageCreateNavigationSchema
>;
export type DashboardPagePreview = z.infer<typeof dashboardPagePreviewSchema>;
export type DashboardPageCustomActionUi = z.infer<
  typeof dashboardPageCustomActionUiSchema
>;
export type DomainHealthResponse = z.infer<typeof domainHealthResponseSchema>;
export type PreviewExpansionRequest = z.infer<
  typeof previewExpansionRequestSchema
>;
export type PreviewExpansionResponse = z.infer<
  typeof previewExpansionResponseSchema
>;
export type ExpandStepInputsRequest = z.infer<
  typeof expandStepInputsRequestSchema
>;
export type ExpandStepInputsResponse = z.infer<
  typeof expandStepInputsResponseSchema
>;
