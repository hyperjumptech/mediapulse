import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { initNodeObservability } from "./index.js";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { logger } from "@workspace/logger";

const mockStart = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("@opentelemetry/sdk-node", () => {
  return {
    NodeSDK: class {
      start = mockStart;
      shutdown = mockShutdown;
    }
  };
});

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("initNodeObservability", () => {
  const originalExit = process.exit;
  const originalOn = process.on;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    process.exit = vi.fn();
    // @ts-ignore
    process.on = vi.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    process.on = originalOn;
    vi.restoreAllMocks();
  });

  it("initializes with default service name", () => {
    // Act
    const sdk = initNodeObservability();

    // Assert
    expect(sdk).toBeDefined();
    expect(mockStart).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: expect.any(String) }),
      expect.stringContaining("initialized")
    );
  });

  it("initializes with custom service name", () => {
    // Act
    initNodeObservability("custom-service");

    // Assert
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: "custom-service" }),
      expect.any(String)
    );
  });

  it("handles initialization errors", () => {
    // Setup
    mockStart.mockImplementationOnce(() => {
      throw new Error("SDK start failed");
    });

    // Act
    initNodeObservability("error-service");

    // Assert
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: "error-service" }),
      expect.stringContaining("Failed")
    );
  });

  it("registers shutdown hooks", () => {
    // Act
    initNodeObservability();

    // Assert
    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
  });
});
