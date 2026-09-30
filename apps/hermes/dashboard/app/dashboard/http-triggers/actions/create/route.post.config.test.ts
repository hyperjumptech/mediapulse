/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

import {
  createCreateHttpTriggerHandler,
  requestValidator,
} from "./route.post.config";

describe("createCreateHttpTriggerHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when pipeline does not exist", async () => {
    // Setup
    const db = {
      pipeline: { findUnique: vi.fn().mockResolvedValue(null) },
      httpTrigger: { create: vi.fn() },
    };
    const handler = createCreateHttpTriggerHandler({
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
      user: mockDashboardUser,
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
      user: mockDashboardUser,
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
          createdById: mockDashboardUser.id,
        }),
      }),
    );
  });

  const enabledPipelineDb = () => ({
    pipeline: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "p1", isActive: true, steps: [] }),
    },
    agentRegistry: { findMany: vi.fn().mockResolvedValue([]) },
    agentConfig: { findMany: vi.fn().mockResolvedValue([]) },
    httpTrigger: {
      create: vi
        .fn()
        .mockResolvedValue({ id: "00000000-0000-4000-8000-000000000013" }),
    },
  });

  it("creates an event trigger without a token", async () => {
    const db = enabledPipelineDb();
    const handler = createCreateHttpTriggerHandler({ db: db as never });

    const result = await handler({
      body: {
        name: "On order",
        pipelineId: "00000000-0000-4000-8000-000000000011",
        method: "POST",
        startMode: "event",
        eventName: "order.created",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(true);
    expect(db.httpTrigger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authType: "DOMAIN_EVENT",
        eventName: "order.created",
        tokenHash: null,
        tokenHint: null,
        method: "POST",
      }),
    });
  });

  it("requires an event name for an event trigger", async () => {
    const db = enabledPipelineDb();
    const handler = createCreateHttpTriggerHandler({ db: db as never });

    const result = await handler({
      body: {
        name: "On order",
        pipelineId: "00000000-0000-4000-8000-000000000011",
        method: "POST",
        startMode: "event",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect((result as { message?: string }).message).toBe(
      "Event name is required",
    );
    expect(db.httpTrigger.create).not.toHaveBeenCalled();
  });

  it("requires a bearer token for a URL trigger", async () => {
    const db = enabledPipelineDb();
    const handler = createCreateHttpTriggerHandler({ db: db as never });

    const result = await handler({
      body: {
        name: "Webhook",
        pipelineId: "00000000-0000-4000-8000-000000000011",
        method: "POST",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect((result as { message?: string }).message).toBe(
      "Bearer token is required",
    );
  });
});

describe("enabled body field", () => {
  it("keeps a JSON false instead of dropping it", () => {
    const parsed = requestValidator.body?.parse({
      name: "Hook",
      pipelineId: "00000000-0000-4000-8000-000000000001",
      method: "POST",
      bearerToken: "secret-token",
      enabled: false,
    }) as { enabled?: boolean };

    expect(parsed.enabled).toBe(false);
  });
});
