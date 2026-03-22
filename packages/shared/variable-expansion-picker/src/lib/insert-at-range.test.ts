import { describe, expect, it } from "vitest";

import { insertAtRange } from "./insert-at-range";

describe("insertAtRange", () => {
  it("inserts at start when start and end are 0", () => {
    const result = insertAtRange("hello", 0, 0, "{{X}}");

    expect(result).toBe("{{X}}hello");
  });

  it("inserts at cursor in middle", () => {
    const result = insertAtRange("hello", 2, 2, "{{Y}}");

    expect(result).toBe("he{{Y}}llo");
  });

  it("replaces selection when start < end", () => {
    const result = insertAtRange("hello", 1, 4, "{{Z}}");

    expect(result).toBe("h{{Z}}o");
  });
});
