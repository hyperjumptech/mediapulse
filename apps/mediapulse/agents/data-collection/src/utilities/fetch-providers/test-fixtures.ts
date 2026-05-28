import { vi } from "vitest";

import type { RateLimiter } from "../resilience";

/**
 * Builds a minimal {@link RateLimiter} stub for fetch-provider unit tests.
 */
export const mockRateLimiter = (): RateLimiter =>
  ({
    acquire: vi.fn().mockResolvedValue(undefined),
    recordResponse: vi.fn(),
  }) as unknown as RateLimiter;
