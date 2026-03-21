import { z } from "zod";

export const domainIntegrationCapabilitySchema = z.enum([
  "expand-step-inputs",
  "preview-expansion",
]);

export const dashboardTemplateSchema = z.enum(["table-v1"]);

export const dashboardPageColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "date-time"]).default("text"),
});

export const dashboardPageActionsSchema = z.object({
  create: z.boolean().default(false),
  update: z.boolean().default(false),
  delete: z.boolean().default(false),
});

/**
 * UI kind for a domain-defined custom action on a table-v1 page.
 * Hermes renders the matching control and invokes the domain API at `apiPrefix` + `path`.
 */
export const dashboardPageCustomActionUiSchema = z.enum(["json-file-upload"]);

/**
 * Metadata for an optional custom action (e.g. bulk import) registered on a dashboard page.
 *
 * @remarks
 * The domain service owns the HTTP handler; Hermes only renders UI from this metadata
 * and forwards requests with the integration auth token.
 */
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
});

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
});

export const dashboardManifestSchema = z.object({
  templateVersion: z.literal(1).default(1),
  pages: z.array(dashboardPageSchema).default([]),
});

export const tableV1ListRequestQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(15),
  q: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const tableV1ListResponseSchema = z.object({
  items: z.array(z.record(z.unknown())),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

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
});

export const registerDomainIntegrationRequestSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  version: z.string().optional(),
  capabilities: z.array(domainIntegrationCapabilitySchema).default([]),
  dashboard: dashboardManifestSchema.default({
    templateVersion: 1,
    pages: [],
  }),
});

export const registerDomainIntegrationResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  version: z.string().nullable(),
  capabilities: z.array(domainIntegrationCapabilitySchema),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  dashboard: dashboardManifestSchema,
});

export const domainHealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string().min(1),
  version: z.string().optional(),
});

export const previewExpansionRequestSchema = z.object({
  expansionString: z.string().min(1),
});

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

export const expandStepInputsRequestSchema = z.object({
  input: z.record(z.unknown()),
  maxTake: z.number().int().nonnegative().optional(),
  defaultTake: z.number().int().nonnegative().optional(),
});

export const expandStepInputsResponseSchema = z.object({
  expandedInputs: z.array(z.record(z.unknown())),
});

export type RegisterDomainIntegrationRequest = z.infer<
  typeof registerDomainIntegrationRequestSchema
>;
export type RegisterDomainIntegrationResponse = z.infer<
  typeof registerDomainIntegrationResponseSchema
>;
export type DashboardManifest = z.infer<typeof dashboardManifestSchema>;
export type DashboardPage = z.infer<typeof dashboardPageSchema>;
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
