/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRunPipelineHandler } from "./route.post.config";

const request = (body: { pipelineId: string }) =>
  ({
    body,
    params: {},
    headers: new Headers(),
    searchParams: {},
    user: undefined,
  }) as never;

describe("createRunPipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler(request({ pipelineId: "p-uuid" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when apiKey is not configured", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      apiKey: "", // empty string so !apiKey is true (undefined would use default from env)
      db: {
        pipeline: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-1", name: "P" }),
        },
        pipelineStep: { findMany: vi.fn().mockResolvedValue([]) },
        ticker: { findMany: vi.fn().mockResolvedValue([]) },
        agentRegistry: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain("AGENT_API_KEY");
  });

  it("returns error when pipeline not found", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      apiKey: "key",
      db: {
        pipeline: { findUnique: vi.fn().mockResolvedValue(null) },
        pipelineStep: { findMany: vi.fn() },
        ticker: { findMany: vi.fn() },
        agentRegistry: { findMany: vi.fn() },
      } as never,
    });
    const result = await handler(request({ pipelineId: "p-missing" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Pipeline not found");
  });

  it("returns success with tickersRun 0 when no tickers", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      apiKey: "key",
      db: {
        pipeline: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-1", name: "P" }),
        },
        pipelineStep: { findMany: vi.fn().mockResolvedValue([]) },
        ticker: { findMany: vi.fn().mockResolvedValue([]) },
        agentRegistry: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({ data: { ok: true, tickersRun: 0 } });
  });

  it("runs pipeline for each ticker and returns tickersRun", async () => {
    const postMock = vi.fn().mockResolvedValue(undefined);
    const handler = createRunPipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      apiKey: "secret",
      post: postMock as never,
      db: {
        pipeline: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-1", name: "P" }),
        },
        pipelineStep: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: "s1", agentId: "ag1", order: 1 }]),
        },
        ticker: {
          findMany: vi.fn().mockResolvedValue([{ id: "t1", symbol: "X" }]),
        },
        agentRegistry: {
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "ag1",
              endpoint: { url: "https://agent.example/run", method: "POST" },
            },
          ]),
        },
      } as never,
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({ data: { ok: true, tickersRun: 1 } });
    expect(postMock).toHaveBeenCalledWith(
      "https://agent.example/run",
      expect.objectContaining({
        json: { tickerId: "t1" },
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      }),
    );
  });
});
