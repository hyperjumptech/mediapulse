import type got from "got";

import type { RateLimiter } from "../resilience";

/** Normalized page payload returned by every fetch provider adapter on success. */
export type NormalizedFetchData = {
  url?: string;
  title?: string;
  content: string;
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
};

/** Contract implemented by every web-fetch provider adapter. */
export type FetchProvider = {
  readonly type: string;
  fetchOne: (
    url: string,
    ctx: ProviderRequestContext,
  ) => Promise<NormalizedFetchData>;
};
