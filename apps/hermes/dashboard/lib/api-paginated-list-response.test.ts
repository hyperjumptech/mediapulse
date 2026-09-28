/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  hasMoreListPages,
  paginatedListJsonResponse,
} from "./api-paginated-list-response";

describe("paginatedListJsonResponse", () => {
  it("returns JSON with items, total, page, pageSize, and hasMore", async () => {
    const response = paginatedListJsonResponse([{ id: "a" }], 1, 1, 20);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: "a" }],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
  });

  it("reports hasMore when rows remain after the current page", async () => {
    const response = paginatedListJsonResponse([{ id: "a" }], 41, 2, 20);

    await expect(response.json()).resolves.toMatchObject({ hasMore: true });
  });
});

describe("hasMoreListPages", () => {
  it("is false on the last full page", () => {
    expect(hasMoreListPages(40, 2, 20)).toBe(false);
  });

  it("is true when the total exceeds the rows seen so far", () => {
    expect(hasMoreListPages(41, 2, 20)).toBe(true);
  });

  it("is false for an empty list", () => {
    expect(hasMoreListPages(0, 1, 20)).toBe(false);
  });
});
