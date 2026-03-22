/** @vitest-environment node */
import type { AgentRunContext } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config, Input } from "./index";
import { run } from "./run";

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/** Builds a minimal run context for tests; token is not used by run. */
function runContext(overrides: {
  input: Input;
  config: Config;
}): AgentRunContext<Input, Config> {
  return { ...overrides, token: undefined };
}

describe("run", () => {
  beforeEach(() => {
    vi.mocked(logger.info).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success true", async () => {
    // Setup
    const ctx = runContext({
      input: { tickerId: "ticker-1" },
      config: {},
    });

    // Act
    const result = await run(ctx);

    // Assert
    expect(result).toEqual({ success: true });
  });

  it("does not log when config.verbose is false", async () => {
    // Setup
    const ctx = runContext({
      input: { tickerId: "ticker-2" },
      config: { verbose: false },
    });

    // Act
    await run(ctx);

    // Assert
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("does not log when config.verbose is undefined", async () => {
    // Setup
    const ctx = runContext({
      input: { tickerId: "ticker-3" },
      config: {},
    });

    // Act
    await run(ctx);

    // Assert
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("logs with tickerId when config.verbose is true", async () => {
    // Setup
    const ctx = runContext({
      input: { tickerId: "AAPL" },
      config: { verbose: true },
    });

    // Act
    await run(ctx);

    // Assert
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { tickerId: "AAPL" },
      "--> ticker-echo received verbose",
    );
  });

  it("returns success true when verbose is true", async () => {
    // Setup
    const ctx = runContext({
      input: { tickerId: "MSFT" },
      config: { verbose: true },
    });

    // Act
    const result = await run(ctx);

    // Assert
    expect(result).toEqual({ success: true });
  });
});
