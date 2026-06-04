import { createHash } from "node:crypto";

import type { DeliverySubscriber } from "./deliver-newsletter.js";

/** Namespace UUID for deterministic test-recipient ids (RFC 4122 name-based). */
const TEST_RECIPIENT_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export type DeliveryDataForRecipients = {
  subscribers: DeliverySubscriber[];
};

export type DeliveryInputForRecipients = {
  emails?: string[] | undefined;
};

export type ResolvedDeliveryRecipients = {
  subscribers: DeliverySubscriber[];
  isTestEmailOverride: boolean;
};

/**
 * Normalizes test override emails: trim, lowercase, dedupe, preserve first-seen order.
 *
 * @param emails - Raw email strings from invoke input.
 * @returns Deduped normalized addresses.
 */
export function normalizeTestEmails(emails: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "" || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/**
 * Builds a deterministic RFC-4122-style UUID from an email for test-only recipients.
 *
 * @param email - Normalized email address.
 * @returns UUID string suitable for delivery-run diagnostics.
 */
export function syntheticTestRecipientUserTickerId(email: string): string {
  const hash = createHash("sha256")
    .update(`${TEST_RECIPIENT_NAMESPACE}:${email}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Resolves `userTickerId` for a test override email, reusing a DB subscriber when matched.
 *
 * @param email - Normalized email address.
 * @param subscribers - Enabled subscribers from agent-data-api.
 * @returns Existing `userTickerId` or a deterministic synthetic UUID.
 */
export function testRecipientUserTickerId(
  email: string,
  subscribers: readonly DeliverySubscriber[],
): string {
  const normalized = email.trim().toLowerCase();
  const match = subscribers.find(
    (s) => s.email.trim().toLowerCase() === normalized,
  );
  return match?.userTickerId ?? syntheticTestRecipientUserTickerId(normalized);
}

/**
 * Chooses delivery recipients: all API subscribers, or test override emails only.
 *
 * @param input - Agent invoke input (`emails` optional).
 * @param deliveryData - Payload from `delivery.get`.
 * @returns Resolved subscriber rows and whether test override is active.
 */
export function resolveDeliveryRecipients(
  input: DeliveryInputForRecipients,
  deliveryData: DeliveryDataForRecipients,
): ResolvedDeliveryRecipients {
  if (input.emails === undefined) {
    return {
      subscribers: [...deliveryData.subscribers],
      isTestEmailOverride: false,
    };
  }

  const normalized = normalizeTestEmails(input.emails);
  const subscribers = normalized.map((email) => ({
    userTickerId: testRecipientUserTickerId(email, deliveryData.subscribers),
    email,
  }));

  return {
    subscribers,
    isTestEmailOverride: true,
  };
}
