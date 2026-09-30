"use server";

import {
  getInvocationPayload,
  invocationPayloadRequestSchema,
  type InvocationPayload,
  type InvocationPayloadRequest,
} from "@/lib/invocation-payload";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";

export type {
  InvocationPayload,
  InvocationPayloadRequest,
  InvocationPayloadSource,
} from "@/lib/invocation-payload";

export const fetchInvocationPayloadAction = async (
  input: InvocationPayloadRequest,
): Promise<InvocationPayload | null> => {
  await requireDashboardAdmin();
  const request = invocationPayloadRequestSchema.parse(input);

  return getInvocationPayload(request);
};
