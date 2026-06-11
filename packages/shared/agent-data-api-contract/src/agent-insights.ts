import { z } from "zod";

const funnelWidgetSchema = z.object({
  kind: z.literal("funnel"),
  stages: z.array(z.object({ label: z.string(), value: z.number() })),
});

const timeSeriesWidgetSchema = z.object({
  kind: z.literal("timeSeries"),
  points: z.array(z.object({ ts: z.string(), value: z.number() })),
  unit: z.string().optional(),
});

const categoryBarWidgetSchema = z.object({
  kind: z.literal("categoryBar"),
  bars: z.array(z.object({ label: z.string(), value: z.number() })),
  unit: z.string().optional(),
});

const breakdownWidgetSchema = z.object({
  kind: z.literal("breakdown"),
  slices: z.array(
    z.object({ label: z.string(), value: z.number(), fraction: z.number() }),
  ),
});

const histogramWidgetSchema = z.object({
  kind: z.literal("histogram"),
  buckets: z.array(z.object({ label: z.string(), count: z.number() })),
});

const tableWidgetSchema = z.object({
  kind: z.literal("table"),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});

const statWidgetSchema = z.object({
  kind: z.literal("stat"),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  delta: z.number().optional(),
});

export const widgetSchema = z.discriminatedUnion("kind", [
  funnelWidgetSchema,
  timeSeriesWidgetSchema,
  categoryBarWidgetSchema,
  breakdownWidgetSchema,
  histogramWidgetSchema,
  tableWidgetSchema,
  statWidgetSchema,
]);

export const kpiCardSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  delta: z.number().optional(),
  sparkline: z.array(z.number()).optional(),
  tone: z.enum(["neutral", "positive", "warning", "critical"]).optional(),
});

export const insightAlertSchema = z.object({
  id: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  sectionRef: z.string().optional(),
});

export const insightSectionSchema = z.object({
  id: z.string(),
  category: z.enum(["what", "when", "where", "who", "why", "how", "other"]),
  title: z.string(),
  insight: z.string().optional(),
  widget: widgetSchema,
});

export const insightsPayloadSchema = z.object({
  agentId: z.string(),
  window: z.enum(["24h", "7d", "30d"]),
  generatedAt: z.string().datetime(),
  kpis: z.array(kpiCardSchema),
  alerts: z.array(insightAlertSchema),
  sections: z.array(insightSectionSchema),
});

export const getAgentInsightsQuerySchema = z.object({
  agentId: z.string().trim().min(1),
  window: z.enum(["24h", "7d", "30d"]),
  tickerId: z.string().optional(),
});

export const getAgentInsightsResponseSchema = insightsPayloadSchema;

export type Widget = z.infer<typeof widgetSchema>;
export type KpiCard = z.infer<typeof kpiCardSchema>;
export type InsightAlert = z.infer<typeof insightAlertSchema>;
export type InsightSection = z.infer<typeof insightSectionSchema>;
export type InsightsPayload = z.infer<typeof insightsPayloadSchema>;
export type GetAgentInsightsQuery = z.infer<typeof getAgentInsightsQuerySchema>;
export type GetAgentInsightsResponse = z.infer<
  typeof getAgentInsightsResponseSchema
>;
