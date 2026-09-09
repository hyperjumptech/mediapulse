import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import type {
  GetPublishersUnresolvedResponse,
  PostPublisherNamesBody,
  PostPublisherNamesResponse,
} from "@workspace/agent-data-api-contract";
import { publisherNameMatchesDomain } from "@workspace/utils";

export const PUBLISHER_NAME_RESOLUTION_LIMIT = 25;

const PUBLISHER_NAME_SYSTEM_PROMPT = [
  "You expand news publisher domain names into the publisher's own written name.",
  "Add spaces and correct capitalisation only.",
  "Never add, drop, translate, or abbreviate words: removing the letters you added back must",
  "reproduce the domain name exactly.",
  'For example "thejakartapost" is "The Jakarta Post" and "cnbcindonesia" is "CNBC Indonesia".',
  "If you are not confident, repeat the input unchanged.",
].join(" ");

const publisherNameResponseSchema = z.object({
  publishers: z.array(
    z.object({
      domain: z.string(),
      displayName: z.string(),
    }),
  ),
});

export type ResolvePublisherNamesLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
};

export type ResolvePublisherNamesOptions = {
  listUnresolved: (query: {
    limit: number;
  }) => Promise<GetPublishersUnresolvedResponse>;
  recordNames: (
    body: PostPublisherNamesBody,
  ) => Promise<PostPublisherNamesResponse>;
  model: { apiKey: string; model: string; baseUrl?: string };
  limit?: number;
  logger?: ResolvePublisherNamesLogger;
  generateObjectFn?: typeof generateObject;
};

export type ResolvePublisherNamesResult = {
  requested: number;
  accepted: number;
  rejected: number;
  recorded: number;
  failed: boolean;
};

const emptyResult: ResolvePublisherNamesResult = {
  requested: 0,
  accepted: 0,
  rejected: 0,
  recorded: 0,
  failed: false,
};

/**
 * Fills in publisher display names that are still the mechanical fallback derived from the domain.
 *
 * - Important: A suggestion is stored only when stripping spacing and casing reproduces the
 *   domain's brand token, so a model that invents or expands a name is rejected rather than shipped.
 *
 * @param options - Transports for reading and writing the reference, model credentials, and limits.
 * @returns Counts of names requested, accepted by the guard, rejected, and written.
 */
export async function resolvePublisherNames({
  listUnresolved,
  recordNames,
  model,
  limit = PUBLISHER_NAME_RESOLUTION_LIMIT,
  logger,
  generateObjectFn = generateObject,
}: ResolvePublisherNamesOptions): Promise<ResolvePublisherNamesResult> {
  let unresolved: GetPublishersUnresolvedResponse;
  try {
    unresolved = await listUnresolved({ limit });
  } catch (error) {
    logger?.warn({ err: error }, "failed to list unresolved publishers");

    return { ...emptyResult, failed: true };
  }

  if (unresolved.publishers.length === 0) {
    return emptyResult;
  }

  const domains = unresolved.publishers.map((publisher) => publisher.domain);
  const openai = createOpenAI({
    apiKey: model.apiKey,
    ...(model.baseUrl ? { baseURL: model.baseUrl } : {}),
  });

  let suggestions: { domain: string; displayName: string }[];
  try {
    const result = await generateObjectFn({
      model: openai(model.model),
      schema: publisherNameResponseSchema,
      system: PUBLISHER_NAME_SYSTEM_PROMPT,
      prompt: `Domains:\n${domains.join("\n")}`,
      maxRetries: 0,
    });
    suggestions = publisherNameResponseSchema.parse(result.object).publishers;
  } catch (error) {
    logger?.warn(
      { err: error, requested: domains.length },
      "publisher name resolution call failed",
    );

    return { ...emptyResult, requested: domains.length, failed: true };
  }

  const requestedDomains = new Set(domains);
  const accepted: PostPublisherNamesBody["publishers"] = [];
  let rejected = 0;
  for (const suggestion of suggestions) {
    const displayName = suggestion.displayName.replace(/\s+/g, " ").trim();
    if (!requestedDomains.has(suggestion.domain)) {
      rejected += 1;
      continue;
    }
    if (!publisherNameMatchesDomain(displayName, suggestion.domain)) {
      rejected += 1;
      logger?.info(
        { domain: suggestion.domain, displayName },
        "rejected publisher name that does not reduce to its domain",
      );
      continue;
    }

    accepted.push({
      domain: suggestion.domain,
      displayName,
      nameSource: "llm",
    });
  }

  if (accepted.length === 0) {
    return { ...emptyResult, requested: domains.length, rejected };
  }

  try {
    const recorded = await recordNames({ publishers: accepted });
    logger?.info(
      {
        requested: domains.length,
        accepted: accepted.length,
        rejected,
        updatedCount: recorded.updatedCount,
      },
      "recorded resolved publisher names",
    );

    return {
      requested: domains.length,
      accepted: accepted.length,
      rejected,
      recorded: recorded.updatedCount,
      failed: false,
    };
  } catch (error) {
    logger?.warn({ err: error }, "failed to record resolved publisher names");

    return {
      requested: domains.length,
      accepted: accepted.length,
      rejected,
      recorded: 0,
      failed: true,
    };
  }
}
