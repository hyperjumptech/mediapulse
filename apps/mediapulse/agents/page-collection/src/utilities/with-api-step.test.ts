/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { withApiStep } from "./with-api-step";

describe("withApiStep", () => {
  it("returns the resolved value when the step succeeds", async () => {
    // Act
    const value = await withApiStep("resolve curated sources", async () => 42);

    // Assert
    expect(value).toBe(42);
  });

  it("wraps thrown Error with the step label and preserves the cause", async () => {
    // Setup
    const original = new Error("Agent data API error: 500");

    // Act
    let caught: Error | undefined;
    try {
      await withApiStep("persist articles", async () => {
        throw original;
      });
    } catch (error) {
      caught = error as Error;
    }

    // Assert
    expect(caught).toBeInstanceOf(Error);
    expect(caught?.message).toBe(
      'Page collection step "persist articles" failed: Agent data API error: 500',
    );
    expect(caught?.cause).toBe(original);
  });

  it("wraps non-Error throws with the step label", async () => {
    // Act
    let caught: Error | undefined;
    try {
      await withApiStep("lookup dead urls", async () => {
        throw "boom";
      });
    } catch (error) {
      caught = error as Error;
    }

    // Assert
    expect(caught?.message).toBe(
      'Page collection step "lookup dead urls" failed: boom',
    );
    expect(caught?.cause).toBe("boom");
  });
});
