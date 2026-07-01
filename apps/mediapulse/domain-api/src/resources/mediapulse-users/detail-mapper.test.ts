/**
 * Unit tests for mediapulse-users detail mapping.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { MediapulseUserDetailRow } from "./detail-mapper";
import {
  formatDetailDateTime,
  formatUnsubscribeMethod,
  mapRowToDetailItem,
  mapSubscriptionToDetailRow,
} from "./detail-mapper";

const buildDetailRow = (
  overrides: Partial<MediapulseUserDetailRow> = {},
): MediapulseUserDetailRow => ({
  id: "user-1",
  email: "a@example.com",
  name: "Ada",
  enabled: true,
  createdAt: new Date("2026-06-17T10:00:00.000Z"),
  updatedAt: new Date("2026-06-18T10:00:00.000Z"),
  userTickers: [],
  ...overrides,
});

const buildSubscription = (
  overrides: Partial<MediapulseUserDetailRow["userTickers"][number]> = {},
): MediapulseUserDetailRow["userTickers"][number] => ({
  id: "ut-1",
  userId: "user-1",
  tickerId: "ticker-1",
  enabled: true,
  language: "en",
  registrationConfirmedAt: new Date("2026-06-17T11:00:00.000Z"),
  unsubscribedAt: null,
  unsubscribeMethod: null,
  createdAt: new Date("2026-06-17T10:30:00.000Z"),
  updatedAt: new Date("2026-06-17T10:30:00.000Z"),
  ticker: { symbol: "BBRI", name: "Bank Rakyat Indonesia" },
  ...overrides,
});

describe("formatDetailDateTime", () => {
  it("returns an ISO string for a date", () => {
    const date = new Date("2026-06-17T11:00:00.000Z");

    expect(formatDetailDateTime(date)).toBe("2026-06-17T11:00:00.000Z");
  });

  it("returns null when the value is absent", () => {
    expect(formatDetailDateTime(null)).toBeNull();
  });
});

describe("formatUnsubscribeMethod", () => {
  it("returns the raw method when present", () => {
    expect(formatUnsubscribeMethod("link")).toBe("link");
  });

  it("returns an em dash when the method is absent", () => {
    expect(formatUnsubscribeMethod(null)).toBe("—");
  });
});

describe("mapSubscriptionToDetailRow", () => {
  it("maps ticker, language, enabled, and lifecycle fields", () => {
    const confirmedAt = new Date("2026-06-17T11:00:00.000Z");
    const unsubscribedAt = new Date("2026-06-20T08:00:00.000Z");

    const row = mapSubscriptionToDetailRow(
      buildSubscription({
        language: "id",
        enabled: false,
        registrationConfirmedAt: confirmedAt,
        unsubscribedAt,
        unsubscribeMethod: "one_click",
      }),
    );

    expect(row).toEqual({
      tickerSymbol: "BBRI",
      tickerName: "Bank Rakyat Indonesia",
      language: "Indonesian",
      enabled: "No",
      registrationConfirmedAt: confirmedAt.toISOString(),
      unsubscribedAt: unsubscribedAt.toISOString(),
      unsubscribeMethod: "one_click",
    });
  });

  it("maps null lifecycle fields to null or an em dash", () => {
    const row = mapSubscriptionToDetailRow(
      buildSubscription({
        registrationConfirmedAt: null,
        unsubscribedAt: null,
        unsubscribeMethod: null,
      }),
    );

    expect(row.registrationConfirmedAt).toBeNull();
    expect(row.unsubscribedAt).toBeNull();
    expect(row.unsubscribeMethod).toBe("—");
  });
});

describe("mapRowToDetailItem", () => {
  it("maps user metadata and subscription rows", () => {
    const createdAt = new Date("2026-06-17T10:00:00.000Z");
    const updatedAt = new Date("2026-06-18T10:00:00.000Z");

    const item = mapRowToDetailItem(
      buildDetailRow({
        createdAt,
        updatedAt,
        userTickers: [
          buildSubscription({ language: "en" }),
          buildSubscription({
            id: "ut-2",
            language: "id",
            ticker: { symbol: "BBCA", name: "Bank Central Asia" },
          }),
        ],
      }),
    );

    expect(item).toEqual({
      id: "user-1",
      email: "a@example.com",
      name: "Ada",
      enabled: "Yes",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      subscriptions: [
        expect.objectContaining({
          tickerSymbol: "BBRI",
          language: "English",
        }),
        expect.objectContaining({
          tickerSymbol: "BBCA",
          language: "Indonesian",
        }),
      ],
    });
  });

  it("maps disabled users and empty subscriptions", () => {
    const item = mapRowToDetailItem(
      buildDetailRow({
        enabled: false,
        name: null,
        userTickers: [],
      }),
    );

    expect(item.enabled).toBe("No");
    expect(item.name).toBeNull();
    expect(item.subscriptions).toEqual([]);
  });
});
