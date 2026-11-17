import { describe, expect, it } from "vitest";

import { chunked } from "./chunked.js";

describe("chunked", () => {
  it("splits items into runs of the given size, keeping their order", () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no chunks for no items", () => {
    expect(chunked([], 50)).toEqual([]);
  });
});
