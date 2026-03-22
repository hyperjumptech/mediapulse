/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import {
  registerTableV1CustomActionRoutes,
  type TableV1CustomActionRegistration,
} from "./register-table-v1-custom-actions";

const jsonOkHandler: TableV1CustomActionRegistration["handler"] = async (c) =>
  c.json({ ok: true });

describe("registerTableV1CustomActionRoutes", () => {
  it("throws when path does not start with /", () => {
    // Setup
    const app = new Hono();

    // Act
    const act = (): void => {
      registerTableV1CustomActionRoutes(app, [
        { path: "bad", method: "POST", handler: jsonOkHandler },
      ]);
    };

    // Assert
    expect(act).toThrow(/must start with "\/"/);
  });

  it("throws on duplicate method+path", () => {
    // Setup
    const app = new Hono();

    // Act
    const act = (): void => {
      registerTableV1CustomActionRoutes(app, [
        { path: "/same", method: "POST", handler: jsonOkHandler },
        { path: "/same", method: "POST", handler: jsonOkHandler },
      ]);
    };

    // Assert
    expect(act).toThrow(/Duplicate table-v1 custom action route/);
  });

  it("allows same path for GET and POST", async () => {
    // Setup
    const app = new Hono();

    // Act
    registerTableV1CustomActionRoutes(app, [
      {
        path: "/dual",
        method: "GET",
        handler: async (c) => c.json({ verb: "GET" }),
      },
      {
        path: "/dual",
        method: "POST",
        handler: async (c) => c.json({ verb: "POST" }),
      },
    ]);
    const getRes = await app.request("http://localhost/dual", {
      method: "GET",
    });
    const postRes = await app.request("http://localhost/dual", {
      method: "POST",
    });

    // Assert
    await expect(getRes.json()).resolves.toEqual({ verb: "GET" });
    await expect(postRes.json()).resolves.toEqual({ verb: "POST" });
  });

  it("registers POST handlers", async () => {
    // Setup
    const app = new Hono();
    registerTableV1CustomActionRoutes(app, [
      { path: "/post-only", method: "POST", handler: jsonOkHandler },
    ]);

    // Act
    const res = await app.request("http://localhost/post-only", {
      method: "POST",
    });

    // Assert
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("registers GET handlers", async () => {
    // Setup
    const app = new Hono();
    registerTableV1CustomActionRoutes(app, [
      { path: "/get-only", method: "GET", handler: jsonOkHandler },
    ]);

    // Act
    const res = await app.request("http://localhost/get-only", {
      method: "GET",
    });

    // Assert
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
