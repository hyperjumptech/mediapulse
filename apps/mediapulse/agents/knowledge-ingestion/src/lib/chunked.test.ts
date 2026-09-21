/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { chunked } from "./chunked.js";

describe("chunked", () => {
  it("keeps the original order across groups", () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns one group when the size covers everything", () => {
    expect(chunked([1, 2], 5)).toStrictEqual([[1, 2]]);
  });

  it("returns nothing for no items", () => {
    expect(chunked([], 4)).toStrictEqual([]);
  });

  it("treats a size below one as one, rather than looping forever", () => {
    expect(chunked([1, 2], 0)).toStrictEqual([[1], [2]]);
  });
});
