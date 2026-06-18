/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ZodError, z } from "zod";

import { buildInternalErrorDetail, internalError, notFound } from "./errors";

const captureConsoleError = (): { calls: unknown[][]; restore: () => void } => {
  const calls: unknown[][] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    calls.push(args);
  });
  return {
    calls,
    restore: () => spy.mockRestore(),
  };
};

describe("buildInternalErrorDetail", () => {
  it("returns the error name, sanitized message, and code when present", () => {
    // Setup
    const error = Object.assign(new Error("Unique constraint violated"), {
      code: "P2002",
      name: "PrismaClientKnownRequestError",
    });

    // Act
    const detail = buildInternalErrorDetail(error);

    // Assert
    expect(detail).toEqual({
      name: "PrismaClientKnownRequestError",
      message: "Unique constraint violated",
      code: "P2002",
    });
  });

  it("falls back to Unknown for non-Error throws", () => {
    // Act
    const detail = buildInternalErrorDetail("boom");

    // Assert
    expect(detail).toEqual({ name: "Unknown", message: "boom" });
  });

  it("redacts sensitive substrings in the message", () => {
    // Setup
    const error = new Error(
      "Failed: token=secret-xyz; Authorization: Bearer abc.def.ghi",
    );

    // Act
    const detail = buildInternalErrorDetail(error);

    // Assert
    expect(detail.message).not.toContain("secret-xyz");
    expect(detail.message).not.toContain("abc.def.ghi");
    expect(detail.message).toContain("[redacted]");
  });

  it("truncates very long messages with an ellipsis", () => {
    // Setup
    const error = new Error("x".repeat(2_000));

    // Act
    const detail = buildInternalErrorDetail(error);

    // Assert
    expect(detail.message.length).toBeLessThanOrEqual(501);
    expect(detail.message.endsWith("…")).toBe(true);
  });
});

describe("internalError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 500 with a sanitized error detail block and keeps the legacy message", async () => {
    // Setup
    const consoleError = captureConsoleError();
    const app = new Hono();
    app.get("/boom", (c) =>
      internalError(
        c,
        Object.assign(new Error("Unique constraint violated"), {
          code: "P2002",
          name: "PrismaClientKnownRequestError",
        }),
      ),
    );

    // Act
    const res = await app.request("/boom");
    const body = await res.json();

    // Assert
    expect(res.status).toBe(500);
    expect(body).toEqual({
      message: "Internal Server Error",
      error: {
        name: "PrismaClientKnownRequestError",
        message: "Unique constraint violated",
        code: "P2002",
      },
    });
    expect(consoleError.calls.length).toBe(1);
    consoleError.restore();
  });

  it("returns 400 with Zod issues when the error is a ZodError", async () => {
    // Setup
    const app = new Hono();
    const schema = z.object({ name: z.string() });
    app.get("/zod", (c) => {
      try {
        schema.parse({});
        return c.json({ ok: true });
      } catch (error) {
        return internalError(c, error);
      }
    });

    // Act
    const res = await app.request("/zod");
    const body = await res.json();

    // Assert
    expect(res.status).toBe(400);
    expect(body.message).toBe("Bad Request");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("passes Response throws through unchanged", async () => {
    // Setup
    const app = new Hono();
    const upstream = new Response("nope", { status: 503 });
    app.get("/pass", (c) => internalError(c, upstream));

    // Act
    const res = await app.request("/pass");

    // Assert
    expect(res).toBe(upstream);
    expect(res.status).toBe(503);
  });

  it("constructs a 400 even when a ZodError is passed directly", async () => {
    // Setup
    const app = new Hono();
    const zodError = new ZodError([
      {
        code: "custom",
        path: ["x"],
        message: "boom",
      },
    ]);
    app.get("/zod-direct", (c) => internalError(c, zodError));

    // Act
    const res = await app.request("/zod-direct");
    const body = await res.json();

    // Assert
    expect(res.status).toBe(400);
    expect(body.message).toBe("Bad Request");
  });
});

describe("notFound", () => {
  it("returns a 404 with the default message", async () => {
    // Setup
    const app = new Hono();
    app.get("/missing", (c) => notFound(c));

    // Act
    const res = await app.request("/missing");
    const body = await res.json();

    // Assert
    expect(res.status).toBe(404);
    expect(body).toEqual({ message: "Not found" });
  });

  it("returns a 404 with a custom message", async () => {
    // Setup
    const app = new Hono();
    app.get("/missing", (c) => notFound(c, "user not found"));

    // Act
    const res = await app.request("/missing");
    const body = await res.json();

    // Assert
    expect(body).toEqual({ message: "user not found" });
  });
});
