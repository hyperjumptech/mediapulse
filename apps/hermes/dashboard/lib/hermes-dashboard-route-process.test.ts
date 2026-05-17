/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardReadOnlyApiKeyError } from "@/lib/dashboard-read-only-api-key-error";
import { createHermesDashboardRoute } from "@/lib/hermes-dashboard-route-process";
import { createRequestValidator, successResponse } from "route-action-gen/lib";
import { z } from "zod";

describe("createHermesDashboardRoute", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 403 with read_only_key body for read-only API keys", async () => {
    // Setup
    const auth = vi.fn().mockRejectedValue(new DashboardReadOnlyApiKeyError());
    const requestValidator = createRequestValidator({
      body: z.object({ name: z.string() }),
      user: auth,
    });
    const responseValidator = z.object({ ok: z.boolean() });
    const handler = vi.fn();
    const route = createHermesDashboardRoute(
      requestValidator,
      responseValidator,
      handler,
    );

    // Act
    const response = await route(
      new Request("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      }),
    );

    // Assert
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: "read_only_key",
      message: "Read-only API key cannot call mutation routes",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 for other auth failures", async () => {
    // Setup
    const auth = vi.fn().mockRejectedValue(new Error("Unauthorized"));
    const requestValidator = createRequestValidator({
      body: z.object({ name: z.string() }),
      user: auth,
    });
    const responseValidator = z.object({ ok: z.boolean() });
    const route = createHermesDashboardRoute(
      requestValidator,
      responseValidator,
      vi.fn(),
    );

    // Act
    const response = await route(
      new Request("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      }),
    );

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: "Unauthorized",
      statusCode: 401,
    });
  });

  it("runs handler when auth succeeds", async () => {
    // Setup
    const user = {
      id: "u1",
      email: "a@b.com",
      name: "A",
      credentialVersion: 0,
    };
    const auth = vi.fn().mockResolvedValue(user);
    const requestValidator = createRequestValidator({
      body: z.object({ name: z.string() }),
      user: auth,
    });
    const responseValidator = z.object({ ok: z.boolean() });
    const handler = vi.fn().mockResolvedValue(successResponse({ ok: true }));
    const route = createHermesDashboardRoute(
      requestValidator,
      responseValidator,
      handler,
    );

    // Act
    const response = await route(
      new Request("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "agent" }),
      }),
    );

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ user, body: { name: "agent" } }),
    );
  });
});
