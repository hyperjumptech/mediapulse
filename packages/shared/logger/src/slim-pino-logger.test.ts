import { PassThrough } from "node:stream";

import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it } from "vitest";

import { slimPinoLogger } from "./slim-pino-logger";

/**
 * Builds a test logger that writes JSON lines to an in-memory buffer.
 *
 * @returns Logger and a function that returns all written log text.
 */
const buildCapturingLogger = (): {
  log: pino.Logger;
  readWritten: () => string;
} => {
  const stream = new PassThrough();
  let written = "";
  stream.on("data", (chunk: Buffer) => {
    written += chunk.toString();
  });
  const log = pino({ level: "info" }, stream);
  return { log, readWritten: () => written };
};

describe("slimPinoLogger", () => {
  it("does not log Request completed for GET /health", async () => {
    // Setup
    const { log, readWritten } = buildCapturingLogger();
    const app = new Hono();
    app.use(slimPinoLogger({ pino: log }));
    app.get("/health", (c) => c.json({ ok: true }));

    // Act
    await app.request("http://localhost/health", { method: "GET" });

    // Assert
    expect(readWritten()).not.toContain("Request completed");
  });

  it("logs Request completed for non-health GET routes", async () => {
    // Setup
    const { log, readWritten } = buildCapturingLogger();
    const app = new Hono();
    app.use(slimPinoLogger({ pino: log }));
    app.get("/other", (c) => c.text("ok"));

    // Act
    await app.request("http://localhost/other", { method: "GET" });

    // Assert
    expect(readWritten()).toContain("Request completed");
  });

  it("logs Request completed for POST /health", async () => {
    // Setup
    const { log, readWritten } = buildCapturingLogger();
    const app = new Hono();
    app.use(slimPinoLogger({ pino: log }));
    app.post("/health", (c) => c.json({ ok: true }));

    // Act
    await app.request("http://localhost/health", { method: "POST" });

    // Assert
    expect(readWritten()).toContain("Request completed");
  });
});
