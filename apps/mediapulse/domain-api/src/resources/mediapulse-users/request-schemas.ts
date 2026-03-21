/**
 * Zod schemas for Mediapulse user create/update JSON bodies (`POST /`, `PATCH /:id`).
 */

import { z } from "zod";

/** Validated body for creating a Mediapulse end user. */
export const mediapulseUserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
});

/** Validated body for updating a Mediapulse end user. */
export const mediapulseUserUpdateSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
});
