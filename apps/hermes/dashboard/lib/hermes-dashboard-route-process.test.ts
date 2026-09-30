/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardReadOnlyApiKeyError } from "@/lib/dashboard-read-only-api-key-error";
import {
  createHermesDashboardRoute,
  internalErrorResponse,
} from "@/lib/hermes-dashboard-route-process";
import {
  createRequestValidator,
  errorResponse,
  successResponse,
} from "route-action-gen/lib";
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

const jsonRequest = (body: string): Request =>
  new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

const routeWithHandler = (
  handler: ReturnType<typeof vi.fn>,
  body: z.ZodType = z.object({ name: z.string() }),
) =>
  createHermesDashboardRoute(
    createRequestValidator({
      body,
      user: vi.fn().mockResolvedValue({ id: "u1" }),
    }),
    z.object({ ok: z.boolean() }),
    handler as never,
  );

describe("createHermesDashboardRoute status codes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 with issues when the body fails validation", async () => {
    const handler = vi.fn();
    const route = routeWithHandler(handler);

    const response = await route(jsonRequest(JSON.stringify({ name: 1 })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.statusCode).toBe(400);
    expect(body.message).toContain("name");
    expect(body.issues).toEqual([
      { path: "name", message: expect.any(String) },
    ]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 400 when a body transform throws a plain error", async () => {
    const throwingBody = z.object({
      config: z.string().transform(() => {
        throw new Error("config must be valid JSON object");
      }),
    });
    const route = routeWithHandler(vi.fn(), throwingBody);

    const response = await route(jsonRequest(JSON.stringify({ config: "x" })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("config must be valid JSON object");
  });

  it("returns 400 for malformed JSON", async () => {
    const handler = vi.fn();
    const route = routeWithHandler(handler);

    const response = await route(jsonRequest("{not json"));

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 400 when the handler rejects with the default status", async () => {
    const route = routeWithHandler(
      vi.fn().mockResolvedValue(errorResponse("Pipeline is invalid")),
    );

    const response = await route(jsonRequest(JSON.stringify({ name: "x" })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "Pipeline is invalid",
      statusCode: 400,
    });
  });

  it("keeps an explicit client error status from the handler", async () => {
    const route = routeWithHandler(
      vi
        .fn()
        .mockResolvedValue(errorResponse("Schedule not found", undefined, 404)),
    );

    const response = await route(jsonRequest(JSON.stringify({ name: "x" })));

    expect(response.status).toBe(404);
  });

  it("keeps 500 for internal errors the handler reports", async () => {
    const route = routeWithHandler(
      vi.fn().mockResolvedValue(internalErrorResponse("Queue unavailable")),
    );

    const response = await route(jsonRequest(JSON.stringify({ name: "x" })));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "Queue unavailable",
      statusCode: 500,
    });
  });

  it("maps a thrown missing-record error to 404", async () => {
    const route = routeWithHandler(
      vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("x"), { code: "P2025" })),
    );

    const response = await route(jsonRequest(JSON.stringify({ name: "x" })));

    expect(response.status).toBe(404);
  });

  it("maps a thrown unique-constraint error to 409", async () => {
    const route = routeWithHandler(
      vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("x"), { code: "P2002" })),
    );

    const response = await route(jsonRequest(JSON.stringify({ name: "x" })));

    expect(response.status).toBe(409);
  });

  it("returns a generic 500 for any other thrown error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const route = routeWithHandler(
      vi.fn().mockRejectedValue(new Error("connection reset by peer")),
    );

    const response = await route(jsonRequest(JSON.stringify({ name: "x" })));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "Internal server error",
      statusCode: 500,
    });
  });
});
