import type { z } from "zod";

/** Minimal logger interface (e.g. pino Logger) for DI. */
export type LoggerLike = {
  error: (obj: unknown, msg?: string) => void;
};

/** Successful agent run. */
export type AgentSuccess = {
  success: true;
};

/** Failed or skipped agent run with optional status and message. */
export type AgentFailure = {
  success: false;
  /** HTTP status code to return (default 500). */
  statusCode?: number;
  /** When true, often returned with 200 for "skipped" flows. */
  skipped?: boolean;
  /** Optional message for the response body. */
  message?: string;
};

/** Result of an agent run. Drives response status and JSON body. */
export type AgentResult = AgentSuccess | AgentFailure;

/** Context passed to the agent run function. */
export type AgentRunContext<TInput> = {
  /** Parsed and validated request body. */
  input: TInput;
  /** Authorization header value (e.g. "Bearer <token>"). */
  token: string | undefined;
};

/** Options for creating the agent Hono app (injectable for tests). */
export type CreateAgentAppOptions = {
  /** Auth API URL for token verification (required when using default verifyToken). */
  authApiUrl?: string;
  /** Custom token verifier; overrides default verifyTokenViaAuthApi. */
  verifyToken?: (token: string) => Promise<boolean>;
  /** Logger instance; defaults to @workspace/logger. */
  logger?: LoggerLike;
};

/** Configuration for a single agent: id, version, input schema, and run logic. */
export type AgentConfig<TInput, TSchema extends z.ZodType<TInput>> = {
  /** Unique agent identifier (e.g. "data-collection"). */
  agentId: string;
  /** Agent version string (e.g. "1.0.0"). */
  agentVersion: string;
  /** Zod schema to parse and validate the POST body. */
  inputSchema: TSchema;
  /**
   * Agent business logic. Receives parsed input and token; returns result
   * that drives HTTP status and response body.
   */
  run: (context: AgentRunContext<TInput>) => Promise<AgentResult>;
};
