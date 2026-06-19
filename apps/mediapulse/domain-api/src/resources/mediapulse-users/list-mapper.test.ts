/**
 * Unit tests for mediapulse-users list mapping.
 */

/** @vitest-environment node */
import type { MediapulseUser } from "@mediapulse/database";
import { describe, expect, it } from "vitest";
import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("maps scalar fields and ISO dates", () => {
    // Setup
    const createdAt = new Date("2024-03-01T08:00:00.000Z");
    const updatedAt = new Date("2024-03-02T08:00:00.000Z");
    const row = {
      id: "u-1",
      email: "a@example.com",
      name: "Ada",
      enabled: true,
      createdAt,
      updatedAt,
    } satisfies MediapulseUser;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item).toEqual({
      id: "u-1",
      email: "a@example.com",
      name: "Ada",
      enabled: "Yes",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("maps disabled users to No", () => {
    const row = {
      id: "u-2",
      email: "b@example.com",
      name: null,
      enabled: false,
      createdAt: new Date("2024-03-01T08:00:00.000Z"),
      updatedAt: new Date("2024-03-02T08:00:00.000Z"),
    } satisfies MediapulseUser;

    expect(mapRowToListItem(row).enabled).toBe("No");
  });
});
