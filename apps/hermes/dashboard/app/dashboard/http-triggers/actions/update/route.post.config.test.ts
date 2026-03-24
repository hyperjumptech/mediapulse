/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createUpdateHttpTriggerHandler } from "./route.post.config";

describe("createUpdateHttpTriggerHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unauthorized when session is missing", async () => {
    // Setup
    const handler = createUpdateHttpTriggerHandler({
      getSession: async () => null,
      db: {} as never,
    });

    // Act
    const result = await handler({
      body: { httpTriggerId: "00000000-0000-4000-8000-000000000020" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when trigger does not exist", async () => {
    // Setup
    const db = {
      httpTrigger: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    const handler = createUpdateHttpTriggerHandler({
      getSession: async () => ({ id: "u1", name: "A", email: "a@test.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: { httpTriggerId: "00000000-0000-4000-8000-000000000021" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "HTTP trigger not found",
    );
    expect(db.httpTrigger.update).not.toHaveBeenCalled();
  });

  it("updates trigger and rotates token", async () => {
    // Setup
    const db = {
      httpTrigger: {
        findUnique: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000022",
          pipelineId: "p1",
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1",
          isActive: true,
          steps: [],
        }),
      },
    };
    const handler = createUpdateHttpTriggerHandler({
      getSession: async () => ({ id: "u1", name: "A", email: "a@test.com" }),
      db: db as never,
    });

    // Act
    const result = await handler({
      body: {
        httpTriggerId: "00000000-0000-4000-8000-000000000022",
        name: "Renamed",
        bearerToken: "new-secret",
        method: "PUT",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(db.httpTrigger.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Renamed",
          method: "PUT",
          tokenHash: expect.any(String),
          tokenHint: "...cret",
        }),
      }),
    );
  });
});
