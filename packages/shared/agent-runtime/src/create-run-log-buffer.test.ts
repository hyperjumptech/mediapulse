import { describe, expect, it } from "vitest";

import { createRunLogBuffer } from "./create-run-log-buffer";

describe("createRunLogBuffer", () => {
  it("collects log entries", () => {
    // Setup
    const buffer = createRunLogBuffer();

    // Act
    buffer.append({ level: "info", message: "started" });
    buffer.append({
      level: "warn",
      message: "slow",
      context: { ms: 100 },
    });

    // Assert
    expect(buffer.toArray()).toEqual([
      { level: "info", message: "started" },
      { level: "warn", message: "slow", context: { ms: 100 } },
    ]);
  });

  it("drops oldest entries when over max capacity", () => {
    // Setup
    const buffer = createRunLogBuffer(2);

    // Act
    buffer.append({ level: "info", message: "first" });
    buffer.append({ level: "info", message: "second" });
    buffer.append({ level: "info", message: "third" });

    // Assert
    expect(buffer.toArray()).toEqual([
      { level: "info", message: "second" },
      { level: "info", message: "third" },
    ]);
  });

  it("returns a copy from toArray", () => {
    // Setup
    const buffer = createRunLogBuffer();
    buffer.append({ level: "info", message: "one" });

    // Act
    const snapshot = buffer.toArray();
    snapshot.push({ level: "info", message: "mutated" });

    // Assert
    expect(buffer.toArray()).toEqual([{ level: "info", message: "one" }]);
  });
});
