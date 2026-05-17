/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { paginatedListJsonResponse } from "./api-paginated-list-response";

describe("paginatedListJsonResponse", () => {
  it("returns JSON with items, total, page, and pageSize", async () => {
    // Act
    const res = paginatedListJsonResponse([{ id: "a" }], 1, 1, 20);

    // Assert
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [{ id: "a" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });
});
