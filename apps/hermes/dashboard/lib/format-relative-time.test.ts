/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./format-relative-time";

const now = new Date("2026-09-28T12:00:00.000Z");

const offsetFromNow = (milliseconds: number) =>
  new Date(now.getTime() + milliseconds);

describe("formatRelativeTime", () => {
  it.each([
    [-30_000, "just now"],
    [-3 * 60_000, "3m ago"],
    [-59 * 60_000, "59m ago"],
    [-2 * 60 * 60_000, "2h ago"],
    [-3 * 24 * 60 * 60_000, "3d ago"],
  ])("formats %d ms in the past as %s", (offset, expected) => {
    // Act
    const label = formatRelativeTime(offsetFromNow(offset), now);

    // Assert
    expect(label).toBe(expected);
  });

  it.each([
    [30_000, "in <1m"],
    [12 * 60_000, "in 12m"],
    [5 * 60 * 60_000, "in 5h"],
    [2 * 24 * 60 * 60_000, "in 2d"],
  ])("formats %d ms in the future as %s", (offset, expected) => {
    // Act
    const label = formatRelativeTime(offsetFromNow(offset), now);

    // Assert
    expect(label).toBe(expected);
  });
});
