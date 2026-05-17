import type { DeliveryRecipientOutcomeStatus } from "@mediapulse/database";

/**
 * Possible recipient statuses exposed by the newsletter detail handler.
 * - `delivered`: the newsletter reached the recipient (checkpoint present, or
 *   a success outcome without a checkpoint paired with `inconsistent: true`).
 * - `failed` / `skipped`: latest matching `DeliveryRecipientOutcome` status.
 * - `not_attempted`: enabled subscriber at request time that has no checkpoint
 *   and no outcome row.
 */
export type RecipientStatus =
  | "delivered"
  | "failed"
  | "skipped"
  | "not_attempted";

/**
 * Input for {@link deriveRecipientStatus}. Each property is optional; absence
 * means "no row exists for this `(newsletter, userTicker)` pair".
 */
export type DeriveRecipientStatusInput = {
  /** Truthy when a `NewsletterDeliveryCheckpoint` exists for the pair. */
  hasCheckpoint: boolean;
  /**
   * Status from the latest matching `DeliveryRecipientOutcome`, or `null` when
   * no outcome row exists.
   */
  latestOutcomeStatus: DeliveryRecipientOutcomeStatus | null;
};

/**
 * Result of {@link deriveRecipientStatus}. The `inconsistent` flag is set when
 * the precedence resolves to `delivered` based on a success outcome without a
 * checkpoint — that points at a delivery pipeline bug.
 */
export type DeriveRecipientStatusResult = {
  status: RecipientStatus;
  inconsistent: boolean;
};

/**
 * Pure precedence rule from PRD REQ-006:
 * checkpoint → latest `DeliveryRecipientOutcome` → `not_attempted`.
 *
 * @param input - Whether a checkpoint exists and the latest outcome status.
 * @returns Resolved status plus the `inconsistent` flag.
 */
export const deriveRecipientStatus = (
  input: DeriveRecipientStatusInput,
): DeriveRecipientStatusResult => {
  if (input.hasCheckpoint) {
    return { status: "delivered", inconsistent: false };
  }
  if (input.latestOutcomeStatus === "success") {
    return { status: "delivered", inconsistent: true };
  }
  if (input.latestOutcomeStatus === "failed") {
    return { status: "failed", inconsistent: false };
  }
  if (input.latestOutcomeStatus === "skipped") {
    return { status: "skipped", inconsistent: false };
  }
  return { status: "not_attempted", inconsistent: false };
};
