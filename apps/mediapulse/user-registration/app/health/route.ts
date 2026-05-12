import { domainHealthResponseSchema } from "@hermes/domain-contract/contracts";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public HTTP liveness for load balancers (no auth).
 *
 * @returns JSON matching the Hermes domain health contract.
 */
export function GET(): NextResponse {
  const body = domainHealthResponseSchema.parse({
    ok: true,
    service: "mediapulse-user-registration",
  });
  return NextResponse.json(body);
}
