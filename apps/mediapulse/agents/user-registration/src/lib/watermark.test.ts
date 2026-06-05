import { describe, expect, it } from "vitest";

import { computeSafeWatermark } from "./watermark.js";

const makeResult = (status: string, receivedDateTime?: string) => ({
  status,
  ...(receivedDateTime !== undefined && { receivedDateTime }),
});

describe("computeSafeWatermark", () => {
  it("returns the newest receivedDateTime when all results are terminal successes", () => {
    const results = [
      makeResult("confirmed_archived", "2024-01-01T10:00:00Z"),
      makeResult("acknowledged_archived", "2024-01-01T12:00:00Z"),
      makeResult("archived_unparseable", "2024-01-01T11:00:00Z"),
    ];

    expect(computeSafeWatermark(results, undefined)).toBe(
      "2024-01-01T12:00:00.000Z",
    );
  });

  it("halts the prefix at the first failed_retry and returns the boundary below it", () => {
    const results = [
      makeResult("confirmed_archived", "2024-01-01T10:00:00Z"),
      makeResult("failed_retry", "2024-01-01T11:00:00Z"),
      makeResult("confirmed_archived", "2024-01-01T12:00:00Z"),
    ];

    expect(computeSafeWatermark(results, undefined)).toBe(
      "2024-01-01T10:00:00.000Z",
    );
  });

  it("returns previousWatermark unchanged when the oldest result is failed_retry", () => {
    const results = [
      makeResult("failed_retry", "2024-01-01T10:00:00Z"),
      makeResult("confirmed_archived", "2024-01-01T11:00:00Z"),
    ];

    expect(computeSafeWatermark(results, "2024-01-01T09:00:00.000Z")).toBe(
      "2024-01-01T09:00:00.000Z",
    );
  });

  it("returns undefined when the oldest result is failed_retry and previousWatermark is undefined", () => {
    const results = [makeResult("failed_retry", "2024-01-01T10:00:00Z")];

    expect(computeSafeWatermark(results, undefined)).toBeUndefined();
  });

  it("sorts out-of-order input before walking the prefix", () => {
    const results = [
      makeResult("confirmed_archived", "2024-01-01T12:00:00Z"),
      makeResult("confirmed_archived", "2024-01-01T10:00:00Z"),
      makeResult("failed_retry", "2024-01-01T11:00:00Z"),
    ];

    expect(computeSafeWatermark(results, undefined)).toBe(
      "2024-01-01T10:00:00.000Z",
    );
  });

  it("does not extend the boundary past a result missing receivedDateTime", () => {
    const results = [
      makeResult("confirmed_archived", "2024-01-01T10:00:00Z"),
      makeResult("confirmed_archived"),
    ];

    expect(computeSafeWatermark(results, undefined)).toBe(
      "2024-01-01T10:00:00.000Z",
    );
  });

  it("returns previousWatermark when results is empty", () => {
    expect(computeSafeWatermark([], "2024-01-01T09:00:00.000Z")).toBe(
      "2024-01-01T09:00:00.000Z",
    );
  });

  it("returns undefined when results is empty and previousWatermark is undefined", () => {
    expect(computeSafeWatermark([], undefined)).toBeUndefined();
  });

  it("accepts all four terminal success statuses in the prefix", () => {
    const results = [
      makeResult("confirmed_archived", "2024-01-01T10:00:00Z"),
      makeResult("acknowledged_archived", "2024-01-01T11:00:00Z"),
      makeResult("invalid_ticker_archived", "2024-01-01T12:00:00Z"),
      makeResult("archived_unparseable", "2024-01-01T13:00:00Z"),
    ];

    expect(computeSafeWatermark(results, undefined)).toBe(
      "2024-01-01T13:00:00.000Z",
    );
  });

  it("normalises receivedDateTime to a full ISO-8601 string with milliseconds", () => {
    const results = [makeResult("confirmed_archived", "2024-06-15T08:30:00Z")];

    expect(computeSafeWatermark(results, undefined)).toBe(
      "2024-06-15T08:30:00.000Z",
    );
  });
});
