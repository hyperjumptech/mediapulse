import { describe, expect, it } from "vitest";

import { fetchUrlFor } from "./fetch-url-rewrites.js";

describe("fetchUrlFor", () => {
  it("fetches a TIMES Indonesia article through its AMP page", () => {
    // Assert
    expect(
      fetchUrlFor(
        "https://timesindonesia.co.id/ekonomi/512345/ojk-dorong-sektor-jasa-keuangan?utm_source=x",
      ),
    ).toBe(
      "https://timesindonesia.co.id/ekonomi/512345/ojk-dorong-sektor-jasa-keuangan/amp",
    );
  });

  it("covers the www host and leaves an AMP URL alone", () => {
    // Assert
    expect(fetchUrlFor("https://www.timesindonesia.co.id/read/1/")).toBe(
      "https://www.timesindonesia.co.id/read/1/amp",
    );
    expect(fetchUrlFor("https://timesindonesia.co.id/read/1/amp")).toBe(
      "https://timesindonesia.co.id/read/1/amp",
    );
  });

  it("leaves other hosts and unparseable URLs unchanged", () => {
    // Assert
    expect(fetchUrlFor("https://www.swa.co.id/read/telkom-laba?x=1")).toBe(
      "https://www.swa.co.id/read/telkom-laba?x=1",
    );
    expect(fetchUrlFor("not a url")).toBe("not a url");
  });
});
