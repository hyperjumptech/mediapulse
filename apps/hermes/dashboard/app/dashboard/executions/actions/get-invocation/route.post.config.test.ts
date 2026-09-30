/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  createGetInvocationHandler,
  requestValidator,
} from "./route.post.config";

const invocationRequest = {
  kind: "schedule" as const,
  parentId: "schedule-1",
  executionId: "execution-1",
  jobId: "job-1",
};

const handlerInput = {
  body: invocationRequest,
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: { id: "u1", name: "A", email: "a@b.com" },
} as never;

describe("createGetInvocationHandler", () => {
  it("returns the masked invocation payload", async () => {
    const getPayload = vi.fn().mockResolvedValue({
      inputMasked: { apiKey: "********" },
      configMasked: null,
      transportError: null,
      agentResponse: { status: "success" },
    });
    const handler = createGetInvocationHandler({ getPayload });

    const result = await handler(handlerInput);

    expect(getPayload).toHaveBeenCalledWith(invocationRequest);
    expect(result).toMatchObject({
      status: true,
      data: { agentResponse: { status: "success" } },
    });
  });

  it("returns 404 when the invocation does not exist", async () => {
    const handler = createGetInvocationHandler({
      getPayload: vi.fn().mockResolvedValue(null),
    });

    const result = await handler(handlerInput);

    expect(result).toMatchObject({ status: false, statusCode: 404 });
  });

  it("rejects an unknown execution kind", () => {
    const parsed = requestValidator.body?.safeParse({
      ...invocationRequest,
      kind: "cron",
    });

    expect(parsed?.success).toBe(false);
  });
});
