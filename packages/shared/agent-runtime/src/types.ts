import type { FetchLike } from "@workspace/agent-auth-client";
import type { z } from "zod";

/** Minimal logger interface (e.g. pino Logger) for DI. */
export type LoggerLike = {
  error: (obj: unknown, msg?: string) => void;
  /** Optional; used for startup warnings (e.g. auto-registration disabled). */
  warn?: (obj: unknown, msg?: string) => void;
  /** Optional; used for info-level logs (e.g. registration success, retries). */
  info?: (obj: unknown, msg?: string) => void;
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
export type AgentRunContext<TInput, TConfig = Record<string, never>> = {
  /** Parsed and validated input (per-run payload). */
  input: TInput;
  /** Parsed and validated config (static configuration for the agent). */
  config: TConfig;
  /** Authorization header value (e.g. "Bearer <token>"). */
  token: string | undefined;
};

/** Options for auto-registering with the agent-registry-api on startup. */
export type AutoRegisterOptions = {
  /** Base URL of the agent-registry-api (e.g. https://registry.example.com). */
  registryUrl: string;
  /**
   * Hermes dashboard API key with purpose `domain_integration`; used to mint a JWT via
   * agent-auth-api `POST /api/token` for registry registration (same key class as Mediapulse domain integration).
   */
  schedulerApiKey: string;
  /** Public URL where this agent is reachable (e.g. https://agent.example.com). */
  agentUrl: string;
  /** Optional fetch for the registry POST (tests). */
  fetchFn?: typeof fetch;
  /** Optional fetch for `POST /api/token` only (tests). */
  tokenFetchFn?: FetchLike;
};

/** Options for creating the agent Hono app (injectable for tests). */
export type CreateAgentAppOptions = {
  /** Auth API URL for token verification (required when using default verifyToken). */
  authApiUrl?: string;
  /** Custom token verifier; overrides default verifyTokenViaAuthApi. */
  verifyToken?: (token: string) => Promise<boolean>;
  /** Logger instance; defaults to @workspace/logger. */
  logger?: LoggerLike;
  /** When set, the agent registers itself with the registry on startup (fire-and-forget). */
  autoRegister?: AutoRegisterOptions;
};

/** Configuration for a single agent: id, version, input/config schemas, and run logic. */
export type AgentConfig<
  TInput,
  TSchema extends z.ZodType<TInput>,
  TConfig = Record<string, never>,
  TConfigSchema extends z.ZodType<TConfig> = z.ZodType<TConfig>,
> = {
  /** Unique agent identifier (e.g. "data-collection"). */
  agentId: string;
  /** Agent version string (e.g. "1.0.0"). */
  agentVersion: string;
  /** Optional short description for admins (e.g. in Hermes agents table). */
  description?: string;
  /** Zod schema to parse and validate the request body's `input` field. */
  inputSchema: TSchema;
  /** Zod schema to parse and validate the request body's `config` field. Defaults to empty object. */
  configSchema?: TConfigSchema;
  /**
   * Agent business logic. Receives parsed input, config, and token; returns result
   * that drives HTTP status and response body.
   */
  run: (context: AgentRunContext<TInput, TConfig>) => Promise<AgentResult>;
};
