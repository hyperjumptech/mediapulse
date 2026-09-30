/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  createCreateDomainIntegrationHandler,
  requestValidator,
} from "./route.post.config";

describe("createCreateDomainIntegrationHandler", () => {
  it("creates a pending integration owned by the caller and returns its key once", async () => {
    const created = {
      id: "00000000-0000-4000-8000-000000000001",
      integrationId: "acme",
      name: "Acme",
      apiKeyPlaintext: "plain-key",
    };
    const createPending = vi.fn().mockResolvedValue(created);
    const handler = createCreateDomainIntegrationHandler({ createPending });

    const result = await handler({
      body: { integrationId: "acme", name: "Acme" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: { id: "user-1", name: "A", email: "a@b.com" },
    } as never);

    expect(createPending).toHaveBeenCalledWith({
      integrationId: "acme",
      name: "Acme",
      userId: "user-1",
    });
    expect(result).toMatchObject({ status: true, data: created });
  });

  it("trims and requires the id and name", () => {
    const parsed = requestValidator.body?.safeParse({
      integrationId: "  ",
      name: " Acme ",
    });

    expect(parsed?.success).toBe(false);
  });
});
