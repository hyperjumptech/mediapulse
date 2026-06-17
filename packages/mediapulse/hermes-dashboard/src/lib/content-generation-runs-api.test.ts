/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getContentGenerationRunById,
  listContentGenerationRuns,
} from "./content-generation-runs-api";

const testConfig = {
  agentDataApiUrl: "http://test-agent-data-api",
  agentAuthApiUrl: "http://test-agent-auth-api",
  internalApiKey: "test-api-key",
  cgaDiagnosticsEnabled: true,
};

const runFixture = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  agentId: "content-generation",
  agentVersion: "1.0.0",
  tickerId: "ticker-1",
  outcome: "success" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("content-generation-runs-api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listContentGenerationRuns returns items and nextCursor", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [runFixture],
      nextCursor: "next-id",
    });
    const client = {
      contentGenerationRuns: { get, create: vi.fn() },
    };

    const result = await listContentGenerationRuns(
      { limit: 10, outcome: "failed" },
      testConfig,
      client,
    );

    expect(get).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 10,
      outcome: "failed",
      tickerId: undefined,
      startTime: undefined,
      endTime: undefined,
    });
    expect(result).toEqual({
      items: [runFixture],
      nextCursor: "next-id",
    });
  });

  it("getContentGenerationRunById returns the matching run", async () => {
    const get = vi.fn().mockResolvedValue({ data: [runFixture] });
    const client = {
      contentGenerationRuns: { get, create: vi.fn() },
    };

    const result = await getContentGenerationRunById(
      runFixture.id,
      testConfig,
      client,
    );

    expect(get).toHaveBeenCalledWith({
      cursor: runFixture.id,
      limit: 1,
    });
    expect(result).toEqual(runFixture);
  });

  it("getContentGenerationRunById returns null when id is missing", async () => {
    const get = vi.fn().mockResolvedValue({ data: [] });
    const client = {
      contentGenerationRuns: { get, create: vi.fn() },
    };

    const result = await getContentGenerationRunById(
      runFixture.id,
      testConfig,
      client,
    );

    expect(result).toBeNull();
  });
});
