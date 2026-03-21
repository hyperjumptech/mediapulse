import { z } from "zod";

export const domainIntegrationCapabilitySchema = z.enum([
  "expand-step-inputs",
  "preview-expansion",
]);

export const registerDomainIntegrationRequestSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  version: z.string().optional(),
  capabilities: z.array(domainIntegrationCapabilitySchema).default([]),
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
