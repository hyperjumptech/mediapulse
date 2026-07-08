import type got from "got";

import type { RateLimiter } from "../resilience";

/** Normalized page payload returned by every fetch provider adapter on success. */
export type NormalizedFetchData = {
  url?: string;
  title?: string;
  content: string;
  author?: string;
  source?: string;
  publishedTime?: string;
  published_at?: string;
  usage?: { tokens?: number };
};

/** Generic runtime configuration for one fetch provider in the chain. */
export type FetchProviderConfig = {
  type: string;
  baseUrl: string;
  authentication: {
    type: "bearer" | "none";
    apiKey?: string;
    headerName?: string;
  };
  /** Extra HTTP headers merged into every request. */
  headers?: Record<string, string>;
  rateLimit: {
    requests: number;
    perSeconds: number;
  };
  concurrency?: number;
  timeoutMs?: number;
  retry?: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
};

/** Minimal structured logger passed into provider adapters. */
export type FetchProviderLogger = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
};

/** Shared per-request context for fetch provider adapters. */
export type ProviderRequestContext = {
  gotClient: typeof got;
  rateLimiter: RateLimiter;
  logger: FetchProviderLogger;
  /** Hard-deadline abort signal; aborting cancels the in-flight HTTP request. */
  signal?: AbortSignal;
};

/** Contract implemented by every web-fetch provider adapter. */
export type FetchProvider = {
  readonly type: string;
  fetchOne: (
    url: string,
    ctx: ProviderRequestContext,
  ) => Promise<NormalizedFetchData>;
};
