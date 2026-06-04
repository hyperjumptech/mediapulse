/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { DeliverySubscriber } from "./deliver-newsletter.js";
import {
  normalizeTestEmails,
  resolveDeliveryRecipients,
  syntheticTestRecipientUserTickerId,
  testRecipientUserTickerId,
} from "./resolve-delivery-recipients.js";

const UT_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UT_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const DB_SUBSCRIBERS: DeliverySubscriber[] = [
  { userTickerId: UT_A, email: "alice@example.com" },
  { userTickerId: UT_B, email: "bob@example.com" },
];

describe("normalizeTestEmails", () => {
  it("trims, lowercases, dedupes, and preserves order", () => {
    expect(
      normalizeTestEmails([
        "  Alice@Example.COM ",
        "bob@example.com",
        "alice@example.com",
      ]),
    ).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("skips empty strings after trim", () => {
    expect(normalizeTestEmails(["", "  ", "a@b.co"])).toEqual(["a@b.co"]);
  });
});

describe("syntheticTestRecipientUserTickerId", () => {
  it("returns a stable UUID for the same email", () => {
    const a = syntheticTestRecipientUserTickerId("test@example.com");
    const b = syntheticTestRecipientUserTickerId("test@example.com");
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("differs across emails", () => {
    expect(syntheticTestRecipientUserTickerId("a@example.com")).not.toBe(
      syntheticTestRecipientUserTickerId("b@example.com"),
    );
  });
});

describe("testRecipientUserTickerId", () => {
  it("reuses subscriber userTickerId when email matches case-insensitively", () => {
    expect(testRecipientUserTickerId("ALICE@example.com", DB_SUBSCRIBERS)).toBe(
      UT_A,
    );
  });

  it("uses synthetic id when email is not a subscriber", () => {
    expect(testRecipientUserTickerId("other@example.com", DB_SUBSCRIBERS)).toBe(
      syntheticTestRecipientUserTickerId("other@example.com"),
    );
  });
});

describe("resolveDeliveryRecipients", () => {
  it("returns API subscribers when emails is omitted", () => {
    expect(
      resolveDeliveryRecipients(
        { emails: undefined },
        { subscribers: DB_SUBSCRIBERS },
      ),
    ).toEqual({
      subscribers: DB_SUBSCRIBERS,
      isTestEmailOverride: false,
    });
  });

  it("maps override emails to subscribers with override flag", () => {
    const resolved = resolveDeliveryRecipients(
      { emails: ["other@example.com", "alice@example.com"] },
      { subscribers: DB_SUBSCRIBERS },
    );
    expect(resolved.isTestEmailOverride).toBe(true);
    expect(resolved.subscribers).toEqual([
      {
        userTickerId: syntheticTestRecipientUserTickerId("other@example.com"),
        email: "other@example.com",
      },
      { userTickerId: UT_A, email: "alice@example.com" },
    ]);
  });

  it("returns empty subscribers for empty override array", () => {
    expect(
      resolveDeliveryRecipients(
        { emails: [] },
        { subscribers: DB_SUBSCRIBERS },
      ),
    ).toEqual({
      subscribers: [],
      isTestEmailOverride: true,
    });
  });
});
