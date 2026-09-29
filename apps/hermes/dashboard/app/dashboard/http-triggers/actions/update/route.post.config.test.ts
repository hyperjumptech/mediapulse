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

  it("parses enabled false from unchecked checkbox (hidden input)", async () => {
    const parsed = await httpTriggerUpdateBodySchema.parseAsync({
      httpTriggerId: "00000000-0000-4000-8000-000000000022",
      enabled: "false",
    });
    expect(parsed.enabled).toBe(false);
  });

  it("parses enabled true from checked checkbox", async () => {
    const parsed = await httpTriggerUpdateBodySchema.parseAsync({
      httpTriggerId: "00000000-0000-4000-8000-000000000022",
      enabled: "on",
    });
    expect(parsed.enabled).toBe(true);
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

  it("persists enabled false when body includes enabled", async () => {
    const db = {
      httpTrigger: {
        findUnique: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000022",
          pipelineId: "p1",
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const handler = createUpdateHttpTriggerHandler({
      db: db as never,
    });

    const result = await handler({
      body: {
        httpTriggerId: "00000000-0000-4000-8000-000000000022",
        enabled: false,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(true);
    expect(db.httpTrigger.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it("turns a URL trigger into an event trigger and drops its token", async () => {
    const update = vi.fn().mockResolvedValue({});
    const db = {
      httpTrigger: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          tokenHash: "hash",
          eventName: null,
        }),
        update,
      },
    };
    const handler = createUpdateHttpTriggerHandler({ db: db as never });

    const result = await handler({
      body: {
        httpTriggerId: "00000000-0000-4000-8000-000000000022",
        startMode: "event",
        eventName: "order.created",
        bearerToken: "ignored",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(true);
    const data = update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).toMatchObject({
      authType: "DOMAIN_EVENT",
      eventName: "order.created",
      tokenHash: null,
      tokenHint: null,
    });
  });

  it("needs a new token to turn an event trigger back into a URL trigger", async () => {
    const update = vi.fn();
    const db = {
      httpTrigger: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          tokenHash: null,
          eventName: "order.created",
        }),
        update,
      },
    };
    const handler = createUpdateHttpTriggerHandler({ db: db as never });

    const result = await handler({
      body: {
        httpTriggerId: "00000000-0000-4000-8000-000000000022",
        startMode: "token",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect((result as { message?: string }).message).toBe(
      "Bearer token is required",
    );
    expect(update).not.toHaveBeenCalled();
  });
});
