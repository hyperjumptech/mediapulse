import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { buildDefaultRootLogger } from "./build-default-root-logger.js";

describe("buildDefaultRootLogger", () => {
  it("uses info level by default when LOG_LEVEL is unset", () => {
    // Act
    const log = buildDefaultRootLogger({});

    // Assert
    expect(log.level).toBe("info");
  });

  it("respects LOG_LEVEL from env", () => {
    // Act
    const log = buildDefaultRootLogger({ LOG_LEVEL: "error" });

    // Assert
    expect(log.level).toBe("error");
  });

  it("writes JSON to injected stream when pretty mode is enabled", () => {
    // Setup
    const stream = new PassThrough();
    let written = "";

    // Act
    const log = buildDefaultRootLogger(
      { LOG_PRETTY: "1", LOG_LEVEL: "info" },
      { createPrettyDestination: () => stream },
    );
    stream.on("data", (chunk: Buffer) => {
      written += chunk.toString();
    });
    log.info("hello-stream");

    // Assert
    expect(written).toContain("hello-stream");
  });
});
