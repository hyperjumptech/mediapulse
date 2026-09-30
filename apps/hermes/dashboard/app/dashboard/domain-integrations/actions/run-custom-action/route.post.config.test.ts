/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createRunDomainCustomActionHandler } from "./route.post.config";

describe("createRunDomainCustomActionHandler", () => {
  it("forwards the action id and payload", async () => {
    const runAction = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { added: 3, updated: 0 } });
    const handler = createRunDomainCustomActionHandler({ runAction });

    const result = await handler({
      body: {
        integrationId: "acme",
        resource: "orders",
        actionId: "import",
        payloadJson: "[]",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: { id: "u1", name: "A", email: "a@b.com" },
    } as never);

    expect(runAction).toHaveBeenCalledWith({
      integrationId: "acme",
      resource: "orders",
      actionId: "import",
      payloadJson: "[]",
    });
    expect(result).toMatchObject({ status: true, data: { added: 3 } });
  });
});
