/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  maskEnqueueDiagnosticEntryPlainText,
  normalizeEnqueueErrorsPayload,
  parseEnqueueErrorTimestampMs,
  sortEnqueueErrorEntriesOldestFirst,
} from "./enqueue-diagnostics";

describe("normalizeEnqueueErrorsPayload", () => {
  it("treats null and undefined as empty entries list", () => {
    expect(normalizeEnqueueErrorsPayload(null)).toEqual({
      kind: "entries",
      entries: [],
    });
    expect(normalizeEnqueueErrorsPayload(undefined)).toEqual({
      kind: "entries",
      entries: [],
    });
  });

  it("returns invalid for non-array", () => {
    expect(normalizeEnqueueErrorsPayload({ a: 1 })).toEqual({
      kind: "invalid",
      raw: { a: 1 },
    });
    expect(normalizeEnqueueErrorsPayload("x")).toEqual({
      kind: "invalid",
      raw: "x",
    });
  });

  it("returns invalid when an element is not a plain object", () => {
    expect(normalizeEnqueueErrorsPayload([{ message: "a" }, "bad"])).toEqual({
      kind: "invalid",
      raw: [{ message: "a" }, "bad"],
    });
    expect(normalizeEnqueueErrorsPayload([null])).toEqual({
      kind: "invalid",
      raw: [null],
    });
    expect(normalizeEnqueueErrorsPayload([[{ message: "nested" }]])).toEqual({
      kind: "invalid",
      raw: [[{ message: "nested" }]],
    });
  });

  it("accepts empty array", () => {
    expect(normalizeEnqueueErrorsPayload([])).toEqual({
      kind: "entries",
      entries: [],
    });
  });

  it("maps legacy message/timestamp entries", () => {
    const errors = [
      { message: "First", timestamp: "2026-04-10T12:00:00.000Z" },
      { message: "Second", timestamp: "2026-04-10T12:01:00.000Z" },
    ];
    expect(normalizeEnqueueErrorsPayload(errors)).toEqual({
      kind: "entries",
      entries: [
        { message: "First", timestamp: "2026-04-10T12:00:00.000Z" },
        { message: "Second", timestamp: "2026-04-10T12:01:00.000Z" },
      ],
    });
  });

  it("maps canonical PRD-shaped entries", () => {
    const errors = [
      {
        timestamp: "2026-04-10T12:34:56.789Z",
        message: "summary",
        severity: "error",
        phase: "enqueue",
        code: "ENQUEUE_BATCH_FAILED",
        pipelineStepId: "step-uuid",
        exception: {
          name: "Error",
          message: "inner",
          stack: "Error: inner\n    at x",
        },
      },
    ];
    expect(normalizeEnqueueErrorsPayload(errors)).toEqual({
      kind: "entries",
      entries: [
        {
          timestamp: "2026-04-10T12:34:56.789Z",
          message: "summary",
          severity: "error",
          phase: "enqueue",
          code: "ENQUEUE_BATCH_FAILED",
          pipelineStepId: "step-uuid",
          exception: {
            name: "Error",
            message: "inner",
            stack: "Error: inner\n    at x",
          },
        },
      ],
    });
  });

  it("omits exception when missing or not an object", () => {
    expect(
      normalizeEnqueueErrorsPayload([{ message: "m", timestamp: "t" }]),
    ).toEqual({
      kind: "entries",
      entries: [{ message: "m", timestamp: "t" }],
    });
    expect(
      normalizeEnqueueErrorsPayload([
        { message: "m", exception: "not-an-object" },
      ]),
    ).toEqual({
      kind: "entries",
      entries: [{ message: "m" }],
    });
  });
});

describe("parseEnqueueErrorTimestampMs", () => {
  it("returns null for missing or invalid", () => {
    expect(parseEnqueueErrorTimestampMs(undefined)).toBeNull();
    expect(parseEnqueueErrorTimestampMs("")).toBeNull();
    expect(parseEnqueueErrorTimestampMs("not-a-date")).toBeNull();
  });

  it("parses ISO strings", () => {
    expect(parseEnqueueErrorTimestampMs("2026-01-02T00:00:00.000Z")).toBe(
      Date.parse("2026-01-02T00:00:00.000Z"),
    );
  });
});

describe("sortEnqueueErrorEntriesOldestFirst", () => {
  it("sorts by timestamp ascending with stable tie-break", () => {
    const entries = [
      { message: "b", timestamp: "2026-01-02T00:00:00.000Z" },
      { message: "a", timestamp: "2026-01-01T00:00:00.000Z" },
      { message: "c", timestamp: "2026-01-01T00:00:00.000Z" },
    ];
    expect(
      sortEnqueueErrorEntriesOldestFirst(entries).map((e) => e.message),
    ).toEqual(["a", "c", "b"]);
  });

  it("places unparseable timestamps after parseable, preserving relative order", () => {
    const entries = [
      { message: "no-ts" },
      { message: "old", timestamp: "2026-01-01T00:00:00.000Z" },
      { message: "bad-ts", timestamp: "invalid" },
      { message: "new", timestamp: "2026-01-03T00:00:00.000Z" },
    ];
    const sorted = sortEnqueueErrorEntriesOldestFirst(entries);
    expect(sorted.map((e) => e.message)).toEqual([
      "old",
      "new",
      "no-ts",
      "bad-ts",
    ]);
  });
});

describe("maskEnqueueDiagnosticEntryPlainText", () => {
  it("redacts Bearer substrings in message and exception fields", () => {
    const out = maskEnqueueDiagnosticEntryPlainText({
      message: "Failed Bearer xyz",
      timestamp: "2026-01-01T00:00:00.000Z",
      exception: {
        name: "Error",
        message: "Bearer abc",
        stack: "at x\nBearer tok\nat y",
      },
    });
    expect(out.message).toBe("Failed Bearer [redacted]");
    expect(out.exception?.message).toBe("Bearer [redacted]");
    expect(out.exception?.stack).toBe("at x\nBearer [redacted]\nat y");
  });
});
