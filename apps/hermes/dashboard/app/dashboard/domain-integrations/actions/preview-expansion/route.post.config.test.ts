/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createPreviewExpansionHandler } from "./route.post.config";

const handlerInput = {
  body: { integrationId: "acme", expansionString: "db:item:id" },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: { id: "u1", name: "A", email: "a@b.com" },
} as never;

describe("createPreviewExpansionHandler", () => {
  it("returns the domain's expansion preview", async () => {
    const preview = vi.fn().mockResolvedValue({ values: ["a", "b"] });
    const handler = createPreviewExpansionHandler({ preview });

    const result = await handler(handlerInput);

    expect(preview).toHaveBeenCalledWith("acme", "db:item:id");
    expect(result).toMatchObject({
      status: true,
      data: { values: ["a", "b"] },
    });
  });

  it("reports a failed preview as a bad gateway", async () => {
    const preview = vi
      .fn()
      .mockRejectedValue(new Error("does not support preview-expansion"));
    const handler = createPreviewExpansionHandler({ preview });

    const result = await handler(handlerInput);

    expect(result).toMatchObject({ status: false, statusCode: 502 });
  });
});
