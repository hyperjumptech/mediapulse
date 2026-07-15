import { z } from "zod";

export const collectionRunSnapshotSchema = z.object({
  agentId: z.string(),
  agentVersion: z.string().optional(),
  cost: z.object({
    searchCredits: z.number().int().nonnegative(),
    searchCreditsByProvider: z.record(
      z.string(),
      z.number().int().nonnegative(),
    ),
  }),
  result: z.object({
    saved: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    byReason: z.record(z.string(), z.number().int().nonnegative()),
  }),
  timing: z.object({
    totalMs: z.number().int().nonnegative(),
    roundsExecuted: z.number().int().nonnegative(),
    stopReason: z.string().optional(),
  }),
});

export type CollectionRunSnapshot = z.infer<typeof collectionRunSnapshotSchema>;
