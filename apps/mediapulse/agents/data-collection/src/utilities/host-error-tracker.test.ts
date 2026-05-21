/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { HostErrorTracker } from "./host-error-tracker";

describe("HostErrorTracker", () => {
  const breakerConfig = {
    enabled: true,
    minAttempts: 5,
    errorRateThreshold: 0.5,
  };

  it("marks cnbc.com skipped after 4 successes and 5 failures", () => {
    const tracker = new HostErrorTracker(breakerConfig);

    for (let index = 0; index < 4; index += 1) {
      tracker.record("cnbc.com", true);
    }
    for (let index = 0; index < 5; index += 1) {
      tracker.record("cnbc.com", false);
    }

    expect(tracker.isSkipped("cnbc.com")).toBe(true);
  });

  it("does not change verdict after host is already skipped", () => {
    const tracker = new HostErrorTracker(breakerConfig);

    for (let index = 0; index < 4; index += 1) {
      tracker.record("cnbc.com", true);
    }
    for (let index = 0; index < 5; index += 1) {
      tracker.record("cnbc.com", false);
    }

    tracker.record("cnbc.com", true);
    tracker.record("cnbc.com", false);

    expect(tracker.isSkipped("cnbc.com")).toBe(true);
  });

  it("does not skip a host with fewer than minAttempts", () => {
    const tracker = new HostErrorTracker(breakerConfig);

    for (let index = 0; index < 3; index += 1) {
      tracker.record("reuters.com", false);
    }

    expect(tracker.isSkipped("reuters.com")).toBe(false);
  });

  it("is a no-op when disabled", () => {
    const tracker = new HostErrorTracker({
      ...breakerConfig,
      enabled: false,
    });

    for (let index = 0; index < 10; index += 1) {
      tracker.record("cnbc.com", false);
    }

    expect(tracker.isSkipped("cnbc.com")).toBe(false);
  });
});
