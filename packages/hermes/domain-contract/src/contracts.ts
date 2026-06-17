import { z } from "zod";

import {
  dashboardManifestSchema,
  dashboardPageActionsSchema,
  dashboardPageColumnSchema,
  dashboardPageCreateNavigationSchema,
  dashboardPageCustomActionSchema,
  dashboardPageCustomActionUiSchema,
  dashboardPagePreviewSchema,
  dashboardPageSchema,
  dashboardTemplateSchema,
  dashboardViewKindSchema,
  dashboardViewPlacementSchema,
  dashboardViewSchema,
  contentViewResponseSchema,
  resourceTableDefaultSortSchema,
  resourceTableListFilterDefinitionSchema,
  resourceTableListFilterRangeParamsSchema,
  resourceTableListFilterUiSchema,
  resourceTableListRequestQuerySchema,
  resourceTableListResponseSchema,
  resourceTableMetaResponseSchema,
  resourceTableSelectOptionSchema,
  resourceTableViewSchema,
  tableV1DefaultSortSchema,
  tableV1ListFilterDefinitionSchema,
  tableV1ListFilterRangeParamsSchema,
  tableV1ListFilterUiSchema,
  tableV1ListRequestQuerySchema,
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
  tableV1SelectOptionSchema,
  normalizeLegacyDashboardView,
  refineDashboardViewPlacement,
  type ContentViewResponse,
  type DashboardManifest,
  type DashboardPage,
  type DashboardPageInput,
  type DashboardView,
  type DashboardViewInput,
  type DashboardViewKind,
  type DashboardViewPlacement,
  type HtmlView,
  type MarkdownView,
  type ResourceTableDefaultSort,
  type ResourceTableListFilterDefinition,
  type ResourceTableListFilterRangeParams,
  type ResourceTableListFilterUi,
  type ResourceTableListRequestQuery,
  type ResourceTableListResponse,
  type ResourceTableMetaResponse,
  type ResourceTableSelectOption,
  type ResourceTableView,
  type TableV1DefaultSort,
  type TableV1ListFilterDefinition,
  type TableV1ListFilterRangeParams,
  type TableV1ListFilterUi,
  type TableV1ListRequestQuery,
  type TableV1ListResponse,
  type TableV1MetaResponse,
  type TableV1SelectOption,
  type TextView,
} from "./dashboard-views";

export {
  dashboardManifestSchema,
  dashboardPageActionsSchema,
  dashboardPageColumnSchema,
  dashboardPageCreateNavigationSchema,
  dashboardPageCustomActionSchema,
  dashboardPageCustomActionUiSchema,
  dashboardPagePreviewSchema,
  dashboardPageSchema,
  dashboardTemplateSchema,
  dashboardViewKindSchema,
  dashboardViewPlacementSchema,
  dashboardViewSchema,
  contentViewResponseSchema,
  resourceTableDefaultSortSchema,
  resourceTableListFilterDefinitionSchema,
  resourceTableListFilterRangeParamsSchema,
  resourceTableListFilterUiSchema,
  resourceTableListRequestQuerySchema,
  resourceTableListResponseSchema,
  resourceTableMetaResponseSchema,
  resourceTableSelectOptionSchema,
  resourceTableViewSchema,
  tableV1DefaultSortSchema,
  tableV1ListFilterDefinitionSchema,
  tableV1ListFilterRangeParamsSchema,
  tableV1ListFilterUiSchema,
  tableV1ListRequestQuerySchema,
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
  tableV1SelectOptionSchema,
  normalizeLegacyDashboardView,
  refineDashboardViewPlacement,
  type ContentViewResponse,
  type DashboardManifest,
  type DashboardPage,
  type DashboardPageInput,
  type DashboardView,
  type DashboardViewInput,
  type DashboardViewKind,
  type DashboardViewPlacement,
  type HtmlView,
  type MarkdownView,
  type ResourceTableDefaultSort,
  type ResourceTableListFilterDefinition,
  type ResourceTableListFilterRangeParams,
  type ResourceTableListFilterUi,
  type ResourceTableListRequestQuery,
  type ResourceTableListResponse,
  type ResourceTableMetaResponse,
  type ResourceTableSelectOption,
  type ResourceTableView,
  type TableV1DefaultSort,
  type TableV1ListFilterDefinition,
  type TableV1ListFilterRangeParams,
  type TableV1ListFilterUi,
  type TableV1ListRequestQuery,
  type TableV1ListResponse,
  type TableV1MetaResponse,
  type TableV1SelectOption,
  type TextView,
};

/**
 * Capabilities supported by the domain integration.
 */
export const domainIntegrationCapabilitySchema = z.enum([
  "expand-step-inputs",
  "preview-expansion",
]);

/**
 * Builds a JSON Schema `type: "object"` fragment for Hermes resource-table create/update forms.
 *
 * @param schema - Object schema with `properties` and optional `required` key list
 * @returns The same object widened for form schema input
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
 */
export type DashboardFormPropertiesMustMatchListRowKeys<
  P extends Record<string, unknown>,
  ListRow extends Record<string, unknown>,
> = [Exclude<keyof P, keyof ListRow>] extends [never] ? P : never;

/**
 * Like {@link dashboardObjectFormJsonSchema}, but every `properties` key must exist on `ListRow`.
 *
 * @typeParam ListRow - List item record from the resource list mapper.
 */
export const dashboardObjectFormJsonSchemaForListRow =
  <ListRow extends Record<string, unknown>>() =>
  <const P extends Record<string, unknown>>(schema: {
    type: "object";
    required?: ReadonlyArray<Extract<keyof P, string>>;
    properties: DashboardFormPropertiesMustMatchListRowKeys<P, ListRow>;
  }): Record<string, unknown> =>
    schema;

/**
 * Schema for a request to register a domain integration.
 */
export const registerDomainIntegrationRequestSchema = z.object({
  integrationId: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  version: z.string().optional(),
  capabilities: z.array(domainIntegrationCapabilitySchema).default([]),
  isDefault: z.boolean().optional(),
  dashboard: dashboardManifestSchema.default({
    templateVersion: 1,
    views: [],
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
