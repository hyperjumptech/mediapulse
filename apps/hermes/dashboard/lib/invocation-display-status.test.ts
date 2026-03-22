import { describe, expect, it } from "vitest";

import { resolveInvocationOutcomeLabel } from "./invocation-display-status";

describe("resolveInvocationOutcomeLabel", () => {
  it("returns semantic success when set", () => {
    // Act
    const label = resolveInvocationOutcomeLabel("completed", "success");

    // Assert
    expect(label).toBe("success");
  });

  it("returns semantic failure when set", () => {
    // Act
    const label = resolveInvocationOutcomeLabel("failed", "failure");

    // Assert
    expect(label).toBe("failure");
  });

  it("maps completed without semantic to success", () => {
    // Act
    const label = resolveInvocationOutcomeLabel("completed", null);

    // Assert
    expect(label).toBe("success");
  });

  it("maps failed without semantic to failure", () => {
    // Act
    const label = resolveInvocationOutcomeLabel("failed", null);

    // Assert
    expect(label).toBe("failure");
  });

  it("returns job status for pending or running rows", () => {
    // Act
    const pending = resolveInvocationOutcomeLabel("pending", null);
    const running = resolveInvocationOutcomeLabel("running", null);

    // Assert
    expect(pending).toBe("pending");
    expect(running).toBe("running");
  });
});
