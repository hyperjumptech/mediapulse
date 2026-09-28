import { describe, expect, it } from "vitest";

import { isHermesExecutionCancellable } from "./hermes-execution-cancellable";

describe("isHermesExecutionCancellable", () => {
  it.each(["pending", "running"])("allows cancelling a %s run", (status) => {
    // Act
    const cancellable = isHermesExecutionCancellable(status);

    // Assert
    expect(cancellable).toBe(true);
  });

  it.each(["succeeded", "partial", "failed", "cancelled", ""])(
    "refuses to cancel a %j run",
    (status) => {
      // Act
      const cancellable = isHermesExecutionCancellable(status);

      // Assert
      expect(cancellable).toBe(false);
    },
  );
});
