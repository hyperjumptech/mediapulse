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
  createSchema: z.record(z.unknown()).optional(),
  updateSchema: z.record(z.unknown()).optional(),
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
  createSchema: z.record(z.unknown()).optional(),
  updateSchema: z.record(z.unknown()).optional(),
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
