import {
  domainEventRequestSchema,
  domainEventResponseSchema,
} from "@hermes/domain-contract";
import { NextResponse } from "next/server";

import { startDomainEventExecutions } from "@/lib/start-domain-event-executions";

const readBearerToken = (request: Request): string | null => {
  const [scheme, value] = (request.headers.get("authorization") ?? "").split(
    " ",
    2,
  );
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;

  return value;
};

const readJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const apiKey = readBearerToken(request);
  if (!apiKey) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = domainEventRequestSchema.safeParse(await readJsonBody(request));
  if (!body.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: body.error.flatten() },
      { status: 400 },
    );
  }
  const requestId = request.headers.get("x-request-id")?.trim() || null;
  const result = await startDomainEventExecutions({
    apiKey,
    request: body.data,
    requestId,
  });
  if (result.status === "unauthorized") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (result.status === "invalid_params") {
    return NextResponse.json(
      { message: `Invalid run params: ${result.message}` },
      { status: 400 },
    );
  }

  return NextResponse.json(
    domainEventResponseSchema.parse({ executions: result.executions }),
    { status: 202 },
  );
}
