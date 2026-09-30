/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createGetAgentContractHandler } from "./route.post.config";

const contractId = "00000000-0000-4000-8000-00000000c0de";

const handlerInput = {
  body: { id: contractId },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: { id: "u1", name: "A", email: "a@b.com" },
} as never;

describe("createGetAgentContractHandler", () => {
  it("returns the contract with its brief", async () => {
    const getById = vi.fn().mockResolvedValue({
      id: contractId,
      name: "Delivery brief",
      brief: "Write for executives.",
      version: "2",
    });
    const handler = createGetAgentContractHandler({
      getById,
      db: {} as never,
    });

    const result = await handler(handlerInput);

    expect(result).toMatchObject({
      status: true,
      data: { id: contractId, brief: "Write for executives." },
    });
  });

  it("returns 404 when the contract does not exist", async () => {
    const handler = createGetAgentContractHandler({
      getById: vi.fn().mockResolvedValue(null),
      db: {} as never,
    });

    const result = await handler(handlerInput);

    expect(result).toMatchObject({ status: false, statusCode: 404 });
  });
});
