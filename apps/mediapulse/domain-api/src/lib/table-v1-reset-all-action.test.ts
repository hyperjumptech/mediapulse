/**
 * Unit tests for table-v1 reset-all custom action helpers.
 */

import { Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
  isPrismaForeignKeyViolation,
} from "./table-v1-reset-all-action";

describe("isPrismaForeignKeyViolation", () => {
  it("returns true for Prisma P2003 errors", () => {
    const error = new Prisma.PrismaClientKnownRequestError("FK", {
      code: "P2003",
      clientVersion: "test",
    });

    expect(isPrismaForeignKeyViolation(error)).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isPrismaForeignKeyViolation(new Error("nope"))).toBe(false);
  });
});

describe("buildResetAllActionManifest", () => {
  it("adds danger-confirm ui and POST method", () => {
    const manifest = buildResetAllActionManifest({
      label: "Reset all rows",
      description: "Deletes everything.",
      confirmMessage: "Sure?",
      confirmToken: "DELETE_ALL_ROWS",
    });

    expect(manifest.ui).toBe("danger-confirm");
    expect(manifest.method).toBe("POST");
    expect(manifest.label).toBe("Reset all rows");
  });
});

describe("createResetAllPostHandler", () => {
  const confirmToken = "DELETE_ALL_ROWS" as const;

  it("deletes all rows when confirm token matches", async () => {
    const deleteAll = vi.fn().mockResolvedValue({ count: 3 });
    const app = new Hono();
    app.post(
      "/reset-all",
      createResetAllPostHandler({ confirmToken, deleteAll }),
    );

    const res = await app.request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirmToken }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 3 });
    expect(deleteAll).toHaveBeenCalledOnce();
  });

  it("returns 400 when confirm token is wrong", async () => {
    const deleteAll = vi.fn();
    const app = new Hono();
    app.post(
      "/reset-all",
      createResetAllPostHandler({ confirmToken, deleteAll }),
    );

    const res = await app.request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "NOPE" }),
    });

    expect(res.status).toBe(400);
    expect(deleteAll).not.toHaveBeenCalled();
  });

  it("returns 409 when delete hits a foreign-key violation", async () => {
    const deleteAll = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("FK", {
        code: "P2003",
        clientVersion: "test",
      }),
    );
    const app = new Hono();
    app.post(
      "/reset-all",
      createResetAllPostHandler({
        confirmToken,
        deleteAll,
        blockedMessage: "Blocked by references.",
      }),
    );

    const res = await app.request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirmToken }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: "Blocked by references." });
  });
});
