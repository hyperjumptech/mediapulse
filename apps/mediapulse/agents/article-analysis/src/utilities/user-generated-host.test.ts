import { describe, expect, it } from "vitest";

import { isUserGeneratedHost } from "./user-generated-host.js";

describe("isUserGeneratedHost", () => {
  it("flags a Kompasiana post", () => {
    expect(
      isUserGeneratedHost(
        "https://www.kompasiana.com/mrdn/6a734ca234777c6be7790db2/telkom-punya-mesin-growth-baru",
      ),
    ).toBe(true);
  });

  it("flags a Blogspot subdomain", () => {
    expect(
      isUserGeneratedHost("https://aristajupiter.blogspot.com/2026/08/x"),
    ).toBe(true);
  });

  it("flags a Blogspot country domain", () => {
    expect(isUserGeneratedHost("https://someone.blogspot.co.id/post")).toBe(
      true,
    );
  });

  it("flags a LinkedIn Pulse article", () => {
    expect(
      isUserGeneratedHost("https://www.linkedin.com/pulse/telkom-outlook-abc"),
    ).toBe(true);
  });

  it("does not flag an editorial outlet", () => {
    expect(
      isUserGeneratedHost(
        "https://investasi.kontan.co.id/news/bisnis-data-center-topang-prospek-tlkm",
      ),
    ).toBe(false);
  });

  it("does not flag a LinkedIn company page", () => {
    expect(
      isUserGeneratedHost("https://www.linkedin.com/company/telkom-indonesia"),
    ).toBe(false);
  });

  it("does not flag a host that merely contains a platform name", () => {
    expect(isUserGeneratedHost("https://mediumwave.co.id/berita/telkom")).toBe(
      false,
    );
  });

  it("treats a missing url as editorial", () => {
    expect(isUserGeneratedHost(null)).toBe(false);
    expect(isUserGeneratedHost(undefined)).toBe(false);
  });
});
