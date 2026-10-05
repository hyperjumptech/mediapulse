import { describe, expect, it } from "vitest";

import { publisherNameMayReplace } from "./publisher.js";

describe("publisherNameMayReplace", () => {
  it("lets any name fill a domain that has no stored name", () => {
    expect(publisherNameMayReplace("derived", null)).toBe(true);
    expect(publisherNameMayReplace("site_metadata", undefined)).toBe(true);
  });

  it("lets a name replace one of equal or lower rank", () => {
    expect(publisherNameMayReplace("site_metadata", "site_metadata")).toBe(
      true,
    );
    expect(publisherNameMayReplace("site_metadata", "llm")).toBe(true);
    expect(publisherNameMayReplace("manual", "site_metadata")).toBe(true);
  });

  it("never lets an automated name replace a manual one", () => {
    expect(publisherNameMayReplace("site_metadata", "manual")).toBe(false);
    expect(publisherNameMayReplace("llm", "manual")).toBe(false);
    expect(publisherNameMayReplace("derived", "llm")).toBe(false);
  });
});
