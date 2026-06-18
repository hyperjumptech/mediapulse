/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { insertDataSourcesIdempotently } from "./insert-data-sources-idempotently";

describe("insertDataSourcesIdempotently", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts only rows that were inserted", async () => {
    // Setup
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: "1" })
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce({ id: "3" });

    // Act
    const inserted = await insertDataSourcesIdempotently(
      [
        {
          url: "https://example.com/a",
          canonicalUrl: "https://example.com/a",
          title: "A",
          content: "A",
        },
        {
          url: "https://example.com/b",
          canonicalUrl: "https://example.com/b",
          title: "B",
          content: "B",
        },
        {
          url: "https://example.com/c",
          canonicalUrl: "https://example.com/c",
          title: "C",
          content: "C",
        },
      ],
      { dataSource: { create } },
    );

    // Assert
    expect(inserted).toBe(2);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("rethrows non-unique Prisma errors", async () => {
    // Setup
    const create = vi.fn().mockRejectedValue({ code: "P2003" });

    // Act / Assert
    await expect(
      insertDataSourcesIdempotently(
        [
          {
            url: "https://example.com/a",
            canonicalUrl: "https://example.com/a",
            title: "A",
            content: "A",
          },
        ],
        { dataSource: { create } },
      ),
    ).rejects.toEqual({ code: "P2003" });
  });
});
