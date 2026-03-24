/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCreateHttpTriggerHandler } from "./route.post.config";

describe("createCreateHttpTriggerHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unauthorized when session is missing", async () => {
    // Setup
    const handler = createCreateHttpTriggerHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await handler({
      body: {
        name: "Trigger",
        pipelineId: "00000000-0000-4000-8000-000000000010",
        method: "POST",
        bearerToken: "secret",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when pipeline does not exist", async () => {
    // Setup
    const db = {
      pipeline: { findUnique: vi.fn().mockResolvedValue(null) },
      httpTrigger: { create: vi.fn() },
    };
    const handler = createCreateHttpTriggerHandler({
      getSession: async () => ({ id: "u1", name: "A", email: "a@test.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: {
        name: "Trigger",
        pipelineId: "00000000-0000-4000-8000-000000000011",
        method: "POST",
        bearerToken: "secret",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Pipeline not found");
    expect(db.httpTrigger.create).not.toHaveBeenCalled();
  });

  it("creates trigger with hashed token", async () => {
    // Setup
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1",
          isActive: true,
          steps: [],
        }),
      },
      httpTrigger: {
        create: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000012",
        }),
      },
    };
    const handler = createCreateHttpTriggerHandler({
      getSession: async () => ({ id: "u1", name: "A", email: "a@test.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: {
        name: "Trigger",
        pipelineId: "p1",
        method: "POST",
        bearerToken: "secret-token",
        enabled: true,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe(
      "00000000-0000-4000-8000-000000000012",
    );
    expect(db.httpTrigger.create).toHaveBeenCalledTimes(1);
    expect(db.httpTrigger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authType: "BEARER_TOKEN",
          method: "POST",
          tokenHash: expect.any(String),
          tokenHint: "...oken",
        }),
      }),
    );
  });
});
