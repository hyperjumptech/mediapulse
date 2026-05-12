import { domainHealthResponseSchema } from "@hermes/domain-contract/contracts";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public HTTP liveness for load balancers (no session required).
 *
 * @returns JSON matching the Hermes domain health contract.
 */
export function GET(): NextResponse {
  const body = domainHealthResponseSchema.parse({
    ok: true,
    service: "hermes-dashboard",
  });
  return NextResponse.json(body);
}
