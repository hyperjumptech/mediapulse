import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import type { ResolvedContentGenerationConfig } from "./config-schema.js";

export type TriageCandidateSource = {
  dataSourceId: string;
  title: string;
  description: string | null;
  section?: string | null;
  sectionScore?: number | null;
};

export const triageFetchRequestSchema = z.object({
  dataSourceId: z.string(),
  reason: z.string(),
});

export const triageOutputSchema = z.object({
  fetchRequests: z.array(triageFetchRequestSchema),
});

export type TriageFetchRequest = z.infer<typeof triageFetchRequestSchema>;

export type TriageObjectResult = {
  object: z.infer<typeof triageOutputSchema>;
};

export type TriageObjectFn = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof triageOutputSchema;
  system: string;
  prompt: string;
  maxRetries: number;
  timeout?: number;
}) => Promise<TriageObjectResult>;

const defaultTriageObject: TriageObjectFn = async (args) => {
  const result = await generateObject({ ...args });

  return { object: result.object };
};

export const TRIAGE_SYSTEM_PROMPT = `You are a research editor deciding which news sources need their full article body fetched before a newsletter can be written from them.

Each candidate source below has a title and a short description (a search snippet or feed/meta description). For most sources the description is enough to write a grounded, specific bullet. For some, the description is too thin, vague, or truncated to support a factual claim, and the full article body is needed.

Return JSON matching { "fetchRequests": [ { "dataSourceId", "reason" } ] }.

Include a source in "fetchRequests" ONLY when its description is genuinely insufficient to write a well-grounded bullet: it lacks the concrete facts (numbers, named parties, outcome) the story turns on, is a bare headline, or is clearly cut off mid-thought. Give a short, specific reason for each.

Do NOT request a fetch when the description already carries the key facts. Prefer fetching few sources over many. Use only the exact "dataSourceId" values provided; never invent ids.`;

export const buildTriageCandidatesBlock = (
  sources: readonly TriageCandidateSource[],
): string =>
  sources
    .map((source) => {
      const sectionLine = source.section ? `\nSection: ${source.section}` : "";
      const description = source.description ?? "(no description)";
      return `dataSourceId: ${source.dataSourceId}\nTitle: ${source.title}${sectionLine}\nDescription: ${description}`;
    })
    .join("\n\n---\n\n");

export async function triageFetchRequests(
  sources: readonly TriageCandidateSource[],
  config: ResolvedContentGenerationConfig,
  context: {
    tickerId: string;
    tickerName?: string;
    tickerSymbol?: string;
  },
  deps: { generateObjectFn?: TriageObjectFn } = {},
): Promise<TriageFetchRequest[]> {
  if (sources.length === 0) {
    return [];
  }

  const generateFn = deps.generateObjectFn ?? defaultTriageObject;

  const openai = createOpenAI({
    apiKey: config.model.apiKey,
    ...(config.model.baseUrl ? { baseURL: config.model.baseUrl } : {}),
  });
  const model = openai(config.model.model);

  const candidatesBlock = buildTriageCandidatesBlock(sources);
  const subject = context.tickerName ?? context.tickerId;
  const prompt = `Ticker: ${subject}${
    context.tickerSymbol ? ` (${context.tickerSymbol})` : ""
  }

Candidate sources:

${candidatesBlock}`;

  const result = await generateFn({
    model,
    schema: triageOutputSchema,
    system: TRIAGE_SYSTEM_PROMPT,
    prompt,
    maxRetries: 0,
    timeout: 60_000,
  });

  const knownIds = new Set(sources.map((source) => source.dataSourceId));
  const seen = new Set<string>();
  const requests: TriageFetchRequest[] = [];
  for (const request of result.object.fetchRequests) {
    if (!knownIds.has(request.dataSourceId) || seen.has(request.dataSourceId)) {
      continue;
    }
    seen.add(request.dataSourceId);
    requests.push(request);
  }

  return requests;
}
