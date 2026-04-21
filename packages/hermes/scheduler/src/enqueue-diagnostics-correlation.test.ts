import { describe, expect, it } from "vitest";

import {
  HERMES_ENQUEUE_CORRELATION_METADATA_KEY,
  mergeHermesEnqueueCorrelationIntoMetadata,
  parseHermesEnqueueCorrelationFromMetadata,
} from "./enqueue-diagnostics-correlation";

describe("mergeHermesEnqueueCorrelationIntoMetadata", () => {
  it("creates correlation block on empty metadata", () => {
    const out = mergeHermesEnqueueCorrelationIntoMetadata(null, {
      requestId: "req-1",
    });
    expect(out).toEqual({
      [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: { requestId: "req-1" },
    });
  });

  it("preserves unrelated keys and merges correlation", () => {
    const out = mergeHermesEnqueueCorrelationIntoMetadata(
      {
        source: "dashboard",
        [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: { requestId: "a" },
      },
      { workerTickId: "99" },
    );
    expect(out.source).toBe("dashboard");
    expect(out[HERMES_ENQUEUE_CORRELATION_METADATA_KEY]).toEqual({
      requestId: "a",
      workerTickId: "99",
    });
  });

  it("overwrites requestId when provided", () => {
    const out = mergeHermesEnqueueCorrelationIntoMetadata(
      {
        [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: {
          requestId: "old",
          workerTickId: "1",
        },
      },
      { requestId: "new" },
    );
    expect(out[HERMES_ENQUEUE_CORRELATION_METADATA_KEY]).toEqual({
      requestId: "new",
      workerTickId: "1",
    });
  });
});

describe("parseHermesEnqueueCorrelationFromMetadata", () => {
  it("returns undefined when missing or empty", () => {
    expect(parseHermesEnqueueCorrelationFromMetadata(null)).toBeUndefined();
    expect(parseHermesEnqueueCorrelationFromMetadata({})).toBeUndefined();
    expect(
      parseHermesEnqueueCorrelationFromMetadata({
        [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: {},
      }),
    ).toBeUndefined();
    expect(
      parseHermesEnqueueCorrelationFromMetadata({
        [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: { requestId: "  " },
      }),
    ).toBeUndefined();
  });

  it("returns trimmed string fields", () => {
    expect(
      parseHermesEnqueueCorrelationFromMetadata({
        [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: {
          requestId: " r1 ",
          workerTickId: "42",
        },
      }),
    ).toEqual({ requestId: "r1", workerTickId: "42" });
  });
});
