/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

import {
  createUpdateHttpTriggerHandler,
  httpTriggerUpdateBodySchema,
} from "./route.post.config";

describe("createUpdateHttpTriggerHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses blank bearerToken as omitted so the current token is kept", async () => {
    const parsed = await httpTriggerUpdateBodySchema.parseAsync({
      httpTriggerId: "00000000-0000-4000-8000-000000000022",
      bearerToken: "",
    });
    expect(parsed.bearerToken).toBeUndefined();
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
      db: db as never,
    });

    // Act
    const result = await handler({
      body: { httpTriggerId: "00000000-0000-4000-8000-000000000021" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
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
      user: mockDashboardUser,
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
