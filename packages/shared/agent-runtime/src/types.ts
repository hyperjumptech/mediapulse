import type { FetchLike } from "@workspace/agent-auth-client";
import type { z } from "zod";

import type { AgentRunLogEntry } from "./create-run-log-buffer.js";

/** Minimal logger interface (e.g. pino Logger) for DI. */
export type LoggerLike = {
  error: (obj: unknown, msg?: string) => void;
  /** Optional; used for startup warnings (e.g. auto-registration disabled). */
  warn?: (obj: unknown, msg?: string) => void;
  /** Optional; used for info-level logs (e.g. registration success, retries). */
  info?: (obj: unknown, msg?: string) => void;
};

/**
 * Result of `run`. Becomes HTTP **200** + Hermes PRD envelope (`schemaVersion`, `status`).
 * Use **throw** for unexpected errors (agent returns 500).
 */
export type AgentRunResult =
  | {
      success: true;
      message?: string;
      details?: Record<string, any>;
      logs?: AgentRunLogEntry[];
    }
  | {
      success: false;
      message: string;
      details?: Record<string, any>;
      logs?: AgentRunLogEntry[];
    };

/**
 * Hermes orchestration ids from invoke headers (`X-Job-Id`, `X-Schedule-Id`, etc.), grouped for `run` context.
 * Present when hermes-worker invokes the agent; omitted for e.g. dashboard "Run now".
 */
export type HermesInvokeCorrelation = {
  /** Hermes job id when `X-Job-Id` was sent (DataQueue / invoke job). */
  jobId?: string;
  /** Hermes execution id when `X-Execution-Id` was sent. */
  executionId?: string;
  /** Hermes `Schedule.id` when `X-Schedule-Id` was sent. */
  scheduleId?: string;
  /** Hermes `ScheduleExecution.id` when `X-Schedule-Execution-Id` was sent. */
  scheduleExecutionId?: string;
  /** Hermes `PipelineStep.id` when `X-Pipeline-Step-Id` was sent. */
  pipelineStepId?: string;
};

/** Context passed to the agent run function. */
export type AgentRunContext<TInput, TConfig = Record<string, never>> = {
  /** Parsed and validated input (per-run payload). */
  input: TInput;
  /** Parsed and validated config (static configuration for the agent). */
  config: TConfig;
  /** Authorization header value (e.g. "Bearer <token>"). */
  token: string | undefined;
  /**
   * Hermes job / execution / schedule / step correlation when the caller sent the corresponding headers
   * (`X-Job-Id`, `X-Execution-Id`, `X-Schedule-Id`, etc.).
   * Omitted when no such headers are present (e.g. "Run now" in the dashboard).
   */
  hermesCorrelation?: HermesInvokeCorrelation;
  /**
   * Opaque product brief supplied by Hermes when the pipeline step references an AgentContract.
   * Absent when no contract is attached to the step (the step runs as today).
   */
  contract?: { brief: string; version: string };
};

/** Options for auto-registering with the agent-registry-api on startup. */
export type AutoRegisterOptions = {
  /** Base URL of the agent-registry-api (e.g. https://registry.example.com). */
  registryUrl: string;
  /**
   * Stable Hermes domain integration id (e.g. `mediapulse`); must match `domain_integration.integration_id`.
   */
  domainIntegrationId: string;
  /**
   * Hermes-generated domain integration API key; used to mint a JWT via
   * agent-auth-api `POST /api/token` for registry registration (same as `DOMAIN_INTEGRATION_API_KEY` in Mediapulse env).
   */
  domainIntegrationApiKey: string;
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
  /** Logger instance; defaults to `@workspace/logger`. */
  logger?: LoggerLike;
  /** When set, the agent registers itself with the agent-registry-api on startup (fire-and-forget). */
  autoRegister?: AutoRegisterOptions;
};

/** Configuration for a single agent: id, version, input/config schemas, and run logic. */
export type AgentConfig<
  TInput,
  TSchema extends z.ZodType<TInput, any, any>,
  TConfig = Record<string, never>,
  TConfigSchema extends z.ZodType<TConfig, any, any> = z.ZodType<
    TConfig,
    any,
    any
  >,
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
   * When true, a request with no contract (or a blank `brief`) is rejected with 400 before `run` is invoked.
   * Generic opt-in: the runtime only enforces that *a* contract is present, not any specific content.
   * Defaults to false (contract stays optional, as for every other agent).
   */
  requireContract?: boolean;
  /**
   * Agent business logic. Returns {@link AgentRunResult}; the runtime maps it to the Hermes JSON envelope on 200.
   */
  run: (context: AgentRunContext<TInput, TConfig>) => Promise<AgentRunResult>;
};
