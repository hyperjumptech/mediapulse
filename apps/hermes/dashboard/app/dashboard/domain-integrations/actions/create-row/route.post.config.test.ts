/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createCreateDomainRowHandler } from "./route.post.config";

const handlerInput = {
  body: {
    integrationId: "acme",
    resource: "orders",
    values: { reference: "A-1" },
  },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: { id: "u1", name: "A", email: "a@b.com" },
} as never;

describe("createCreateDomainRowHandler", () => {
  it("returns the created row", async () => {
    const createRow = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { id: "row-1" } });
    const handler = createCreateDomainRowHandler({ createRow });

    const result = await handler(handlerInput);

    expect(createRow).toHaveBeenCalledWith({
      integrationId: "acme",
      resource: "orders",
      values: { reference: "A-1" },
    });
    expect(result).toMatchObject({ status: true, data: { id: "row-1" } });
  });

  it("returns the rejection status and message", async () => {
    const createRow = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      message: "View does not allow create",
    });
    const handler = createCreateDomainRowHandler({ createRow });

    const result = await handler(handlerInput);

    expect(result).toMatchObject({
      status: false,
      statusCode: 403,
      message: "View does not allow create",
    });
  });
});
