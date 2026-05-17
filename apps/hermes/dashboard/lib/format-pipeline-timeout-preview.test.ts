/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PIPELINE_TIMEOUT_MS,
  formatMsDuration,
  formatPipelineTimeoutPreview,
} from "./format-pipeline-timeout-preview";

describe("formatPipelineTimeoutPreview", () => {
  it("describes empty input as Hermes default", () => {
    const out = formatPipelineTimeoutPreview("");
    expect(out).toContain("Hermes default");
    expect(out).toContain("300,000");
  });

  it("trims whitespace for empty", () => {
    expect(formatPipelineTimeoutPreview("   ")).toContain("Hermes default");
  });

  it("rejects non-digit characters", () => {
    expect(formatPipelineTimeoutPreview("12a")).toContain("digits only");
  });

  it("rejects zero and negatives", () => {
    expect(formatPipelineTimeoutPreview("0")).toContain(
      "positive whole number",
    );
    expect(formatPipelineTimeoutPreview("-1")).toContain("digits only");
  });

  it("formats valid milliseconds", () => {
    expect(formatPipelineTimeoutPreview("300000")).toContain("Request timeout");
    expect(formatPipelineTimeoutPreview("300000")).toContain("5 minutes");
    expect(formatPipelineTimeoutPreview("300000")).toContain("300,000");
  });
});

describe("DEFAULT_PIPELINE_TIMEOUT_MS", () => {
  it("is five minutes", () => {
    expect(DEFAULT_PIPELINE_TIMEOUT_MS).toBe(300_000);
  });
});

describe("formatMsDuration", () => {
  it("formats seconds only", () => {
    expect(formatMsDuration(3000)).toMatch(/3 seconds/);
  });

  it("formats minutes", () => {
    expect(formatMsDuration(300_000)).toBe("5 minutes");
  });

  it("formats minutes and seconds", () => {
    expect(formatMsDuration(350_000)).toContain("5 minutes");
    expect(formatMsDuration(350_000)).toContain("50 seconds");
  });

  it("formats hours", () => {
    expect(formatMsDuration(3_600_000)).toBe("1 hour");
  });

  it("formats hours and minutes", () => {
    expect(formatMsDuration(4_020_000)).toContain("1 hour");
    expect(formatMsDuration(4_020_000)).toContain("7 minutes");
  });
});
