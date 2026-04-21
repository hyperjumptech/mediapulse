/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  diagnosticFromCaughtError,
  ENQUEUE_DIAGNOSTIC_MAX_FIELD_CHARS,
  truncateEnqueueDiagnosticEntry,
} from "./enqueue-diagnostics";

describe("truncateEnqueueDiagnosticEntry", () => {
  it("sets truncated when message exceeds cap", () => {
    const long = "x".repeat(ENQUEUE_DIAGNOSTIC_MAX_FIELD_CHARS + 10);
    const out = truncateEnqueueDiagnosticEntry({
      message: long,
      timestamp: "2026-01-01T00:00:00.000Z",
      phase: "enqueue",
    });
    expect(out.message.length).toBeLessThanOrEqual(
      ENQUEUE_DIAGNOSTIC_MAX_FIELD_CHARS + 2,
    );
    expect(out.truncated).toBe(true);
  });

  it("preserves short entries", () => {
    const out = truncateEnqueueDiagnosticEntry({
      message: "ok",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(out.message).toBe("ok");
    expect(out.truncated).toBeUndefined();
  });
});

describe("diagnosticFromCaughtError", () => {
  it("includes exception name and stack for Error", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n  at test.ts:1:1";
    const d = diagnosticFromCaughtError(err, {
      phase: "enqueue",
      messagePrefix: "Failed to enqueue agent invocations",
    });
    expect(d.message).toContain("Failed to enqueue agent invocations");
    expect(d.message).toContain("boom");
    expect(d.phase).toBe("enqueue");
    expect(d.exception?.name).toBe("Error");
    expect(d.exception?.stack).toContain("at test.ts");
  });

  it("handles non-Error values", () => {
    const d = diagnosticFromCaughtError("plain", { phase: "transaction" });
    expect(d.message).toBe("plain");
    expect(d.exception).toBeUndefined();
  });
});
