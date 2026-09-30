/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createGetAgentHandler } from "./route.post.config";

const agentRegistryId = "00000000-0000-4000-8000-000000000001";

const handlerInput = {
  body: { id: agentRegistryId },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: { id: "u1", name: "A", email: "a@b.com" },
} as never;

describe("createGetAgentHandler", () => {
  it("returns the agent detail", async () => {
    const getDetail = vi.fn().mockResolvedValue({
      id: agentRegistryId,
      agentId: "writer",
      agentTabViews: [],
    });
    const handler = createGetAgentHandler({ getDetail });

    const result = await handler(handlerInput);

    expect(getDetail).toHaveBeenCalledWith(agentRegistryId);
    expect(result).toMatchObject({
      status: true,
      data: { agentId: "writer", agentTabViews: [] },
    });
  });

  it("returns 404 when the agent does not exist", async () => {
    const handler = createGetAgentHandler({
      getDetail: vi.fn().mockResolvedValue(null),
    });

    const result = await handler(handlerInput);

    expect(result).toMatchObject({ status: false, statusCode: 404 });
  });
});
