import { describe, expect, it } from "vitest";

import { sanitizeSourceContentMarkdownUrls } from "./sanitize-source-content-markdown-urls.js";

describe("sanitizeSourceContentMarkdownUrls", () => {
  it("preserves absolute https links on public hosts", () => {
    const input = "Read [Reuters](https://www.reuters.com/world/).";
    expect(sanitizeSourceContentMarkdownUrls(input)).toBe(input);
  });

  it("replaces blob markdown image targets with alt text only", () => {
    const input =
      "Bad ![Image 2](blob:http://localhost/a2f9abce2c7bd7e72f7c1065e8e25533) end";
    expect(sanitizeSourceContentMarkdownUrls(input)).toBe("Bad Image 2 end");
  });

  it("replaces localhost https markdown links with link text only", () => {
    const input = "See [local](http://localhost:3000/path).";
    expect(sanitizeSourceContentMarkdownUrls(input)).toBe("See local.");
  });

  it("replaces relative markdown links with link text only", () => {
    const input = "Nav [World](/world/).";
    expect(sanitizeSourceContentMarkdownUrls(input)).toBe("Nav World.");
  });

  it("strips raw blob URLs outside markdown", () => {
    const input = "x blob:http://localhost/abc y";
    expect(sanitizeSourceContentMarkdownUrls(input)).toBe("x  y");
  });

  it("strips raw data and javascript URLs", () => {
    const input = "a data:image/png;base64,AAA b javascript:alert(1) c";
    expect(sanitizeSourceContentMarkdownUrls(input)).toBe("a  b  c");
  });

  it("handles empty content", () => {
    expect(sanitizeSourceContentMarkdownUrls("")).toBe("");
  });
});
