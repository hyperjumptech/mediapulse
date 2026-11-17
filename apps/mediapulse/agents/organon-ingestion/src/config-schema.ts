import { z } from "zod";

import { fetchProviderEntrySchema } from "@workspace/agent-ingestion";

const defaultFetchProviders = [
  { provider: "serper" as const, apiKey: "{{SERPER_API_KEY}}" },
  { provider: "diffbot" as const, apiKey: "{{DIFFBOT_API_KEY}}" },
];

export const ConfigSchema = z.object({
  organonUrl: z
    .string()
    .default("{{ORGANON_API_URL}}")
    .describe("Base URL of Organon, such as https://organon.hyperjump.tech."),
  organonApiKey: z
    .string()
    .default("{{ORGANON_INGESTION_API_KEY}}")
    .describe(
      "Organon API key with write access, used only for ingestion. A job is visible only to the key that started it, so the failed-job sweep needs the same key.",
    ),
  sendFrom: z
    .string()
    .datetime({ offset: true })
    .describe(
      "The cutover. Only articles collected at or after this time are sent.",
    ),
  lookbackDays: z
    .number()
    .int()
    .positive()
    .max(30)
    .default(7)
    .describe(
      "How far back a first placement may be for its article to be sent. An article whose body can't be fetched stops being retried after this.",
    ),
  maxSendsPerRun: z
    .number()
    .int()
    .positive()
    .max(500)
    .default(200)
    .describe("Most articles sent in one run. Each send costs a model call."),
  maxFetchesPerRun: z
    .number()
    .int()
    .positive()
    .max(500)
    .default(200)
    .describe("Most missing bodies fetched in one run."),
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(8)
    .default(2)
    .describe("Articles sent to Organon at the same time."),
  requestTimeoutMs: z
    .number()
    .int()
    .positive()
    .default(30_000)
    .describe("Timeout for each call to Organon."),
  fetch: z
    .object({
      providers: z
        .array(fetchProviderEntrySchema)
        .min(1)
        .default([...defaultFetchProviders])
        .describe("Ordered fetch-provider chain for missing bodies."),
    })
    .prefault({}),
  resilience: z
    .object({
      deadUrlCache: z
        .object({
          enabled: z.boolean().default(true),
          skipLookupBatchSize: z.number().int().positive().default(50),
        })
        .prefault({}),
      hostErrorBreaker: z
        .object({
          enabled: z.boolean().default(true),
          minAttempts: z.number().int().positive().default(5),
          errorRateThreshold: z.number().min(0).max(1).default(0.5),
        })
        .prefault({}),
    })
    .prefault({}),
  dryRun: z
    .boolean()
    .default(false)
    .describe(
      "Read the candidates and report what would be sent, without fetching, sending or recording anything.",
    ),
});

export type OrganonIngestionConfig = z.infer<typeof ConfigSchema>;
