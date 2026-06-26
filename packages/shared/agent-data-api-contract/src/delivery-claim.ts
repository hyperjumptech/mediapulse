import { z } from "zod";

/** Claim/release a per-recipient delivery checkpoint before sending (shared by both verbs). */
export const deliveryClaimBodySchema = z.object({
  userTickerId: z.string().uuid(),
  newsletterId: z.string().uuid(),
});

export const postDeliveryClaimResponseSchema = z.object({
  /**
   * True when this caller inserted the checkpoint and now owns the send. False when another
   * delivery run already claimed (or delivered) this recipient, so the caller must not send.
   */
  claimed: z.boolean(),
});

export const postDeliveryClaimReleaseResponseSchema = z.object({
  /** True when an unfinalized claim was removed so the recipient can be retried later. */
  released: z.boolean(),
});

export type DeliveryClaimBody = z.infer<typeof deliveryClaimBodySchema>;
export type PostDeliveryClaimResponse = z.infer<
  typeof postDeliveryClaimResponseSchema
>;
export type PostDeliveryClaimReleaseResponse = z.infer<
  typeof postDeliveryClaimReleaseResponseSchema
>;
