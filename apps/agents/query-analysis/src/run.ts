import {
  dataApiGet,
  dataApiPost,
  type AgentRunContext,
} from "@workspace/agent-runtime";
import { env } from "@workspace/env/agents-query-analysis";
import { logger } from "@workspace/logger";
import OpenAI from "openai";
import {
  buildPrompt,
  EXPECTED_QUERY_COUNT,
  type QueryAnalysisContext,
} from "./build-prompt.js";
import type { Config, Input } from "./index.js";
import { parseQueryResponse } from "./parse-query-response.js";

type OpenAiLike = {
  chat: {
    completions: {
      create: (params: {
        model: string;
        messages: Array<{ role: "system" | "user"; content: string }>;
        response_format: { type: "json_object" };
      }) => Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
};

type RunDependencies = {
  openAiClient?: OpenAiLike;
  dataApiGetFn?: typeof dataApiGet;
  dataApiPostFn?: typeof dataApiPost;
};

/**
 * Runs query-analysis orchestration:
 * fetch context, generate eight queries via OpenAI, validate/parse, and store to API.
 *
 * @param context - Agent runtime context.
 * @param dependencies - Optional injectable dependencies for tests.
 * @returns Success when queries are generated and persisted.
 */
export const run = async (
  context: AgentRunContext<Input, Config>,
  dependencies: RunDependencies = {},
) => {
  const {
    openAiClient,
    dataApiGetFn = dataApiGet,
    dataApiPostFn = dataApiPost,
  } = dependencies;
  const { input, config, token } = context;
  const effectiveOpenAiClient =
    openAiClient ?? createOpenAiClient(config.openAiApiKey);

  const queryAnalysisContext = await dataApiGetFn<QueryAnalysisContext>(
    token,
    env.AGENT_DATA_API_URL,
    "/api/query-analysis",
    {
      tickerId: input.tickerId,
    },
  );

  const prompt = buildPrompt(queryAnalysisContext);
  const response = await effectiveOpenAiClient.chat.completions.create({
    model: config.openAiModel,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty query-analysis response");
  }

  const parsed = parseQueryResponse(content);
  if (parsed.queries.length !== EXPECTED_QUERY_COUNT) {
    throw new Error(
      `OpenAI must return exactly ${EXPECTED_QUERY_COUNT} queries, received ${parsed.queries.length}`,
    );
  }

  if (config.verbose) {
    logger.info(
      {
        tickerId: input.tickerId,
        queryAngles: parsed.queries.map((query) => query.angle),
      },
      "Generated query-analysis angles",
    );
  }

  await dataApiPostFn(token, env.AGENT_DATA_API_URL, "/api/query-analysis", {
    tickerId: input.tickerId,
    queries: parsed.queries.map((query) => ({
      text: query.text,
    })),
  });

  return { success: true };
};

/**
 * Creates a minimal OpenAI client adapter for query generation calls.
 *
 * @param apiKey - OpenAI API key from agent config.
 * @returns OpenAI chat client with typed completion method.
 */
const createOpenAiClient = (apiKey: string): OpenAiLike =>
  new OpenAI({
    apiKey,
  }) as unknown as OpenAiLike;
