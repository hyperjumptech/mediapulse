import type { Context } from "hono";
import { describe, expect, it } from "vitest";

import { slimHonoPinoHttpLoggerOptions } from "./hono-pino-slim-http.js";

describe("slimHonoPinoHttpLoggerOptions", () => {
  it("onReqBindings includes method, url, and correlation headers only", () => {
    // Setup
    const fake = {
      req: {
        method: "POST",
        path: "/",
        header: () => ({
          Accept: "*/*",
          "X-Job-Id": "job-1",
        }),
      },
      res: { status: 200 },
    };

    // Act
    const bindings = slimHonoPinoHttpLoggerOptions.onReqBindings!(
      fake as unknown as Context,
    );

    // Assert
    expect(bindings).toEqual({
      req: {
        method: "POST",
        url: "/",
        headers: { "x-job-id": "job-1" },
      },
    });
  });

  it("onReqBindings omits headers when no correlation headers are present", () => {
    // Setup
    const fake = {
      req: {
        method: "GET",
        path: "/health",
        header: () => ({ "user-agent": "curl/8" }),
      },
      res: { status: 200 },
    };

    // Act
    const bindings = slimHonoPinoHttpLoggerOptions.onReqBindings!(
      fake as unknown as Context,
    );

    // Assert
    expect(bindings).toEqual({ req: { method: "GET", url: "/health" } });
  });

  it("onResBindings returns status only", () => {
    // Setup
    const fake = {
      req: { method: "GET", path: "/health", header: () => ({}) },
      res: { status: 204 },
    };

    // Act
    const bindings = slimHonoPinoHttpLoggerOptions.onResBindings!(
      fake as unknown as Context,
    );

    // Assert
    expect(bindings).toEqual({ res: { status: 204 } });
  });
});
