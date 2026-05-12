import { Text } from "@react-email/components";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  defaultIsAllowedNewsletterLinkUrl,
  renderInlineMarkdownLinks,
  type RenderInlineMarkdownLinksDependencies,
} from "./render-inline-markdown-links.js";

const linkStyle = { color: "#2563eb" };

describe("defaultIsAllowedNewsletterLinkUrl", () => {
  it("accepts https URLs with a host", () => {
    expect(
      defaultIsAllowedNewsletterLinkUrl("https://news.example.com/path?q=1"),
    ).toBe(true);
  });

  it("accepts uppercase HTTPS scheme after trimming", () => {
    expect(defaultIsAllowedNewsletterLinkUrl("  HTTPS://Example.COM/x  ")).toBe(
      true,
    );
  });

  it("rejects http", () => {
    expect(defaultIsAllowedNewsletterLinkUrl("http://a.test/")).toBe(false);
  });

  it("rejects non-URL strings", () => {
    expect(defaultIsAllowedNewsletterLinkUrl("not-a-url")).toBe(false);
  });

  it("rejects whitespace-only input", () => {
    expect(defaultIsAllowedNewsletterLinkUrl("   ")).toBe(false);
  });

  it("rejects invalid URLs that still start with https://", () => {
    expect(defaultIsAllowedNewsletterLinkUrl("https://%")).toBe(false);
  });
});

describe("renderInlineMarkdownLinks", () => {
  const renderInText = (
    text: string,
    deps: RenderInlineMarkdownLinksDependencies = {},
  ) =>
    renderToStaticMarkup(
      <Text>{renderInlineMarkdownLinks(text, linkStyle, deps)}</Text>,
    );

  it("returns plain text when there are no markdown links", () => {
    const html = renderInText("Hello world.");
    expect(html).toContain("Hello world.");
    expect(html).not.toContain("<a ");
  });

  it("renders a single https markdown link as an anchor", () => {
    const html = renderInText("[Label](https://example.com/page) tail.");
    expect(html).toContain('href="https://example.com/page"');
    expect(html).toContain(">Label<");
    expect(html).toContain(" tail.");
    expect(html).not.toContain("[Label](");
  });

  it("renders multiple links", () => {
    const html = renderInText(
      "[One](https://a.test/1) mid [Two](https://b.test/2)",
    );
    expect(html.match(/href="https:\/\//g)?.length).toBe(2);
  });

  it("leaves http links as literal markdown text", () => {
    const html = renderInText("[X](http://insecure.example/)");
    expect(html).toContain("[X](http://insecure.example/)");
    expect(html).not.toContain('href="http://');
  });

  it("uses isAllowedUrl override when provided", () => {
    const html = renderInText("[X](http://allowed.example/)", {
      isAllowedUrl: (h: string) => h.startsWith("http://allowed"),
    });
    expect(html).toContain('href="http://allowed.example/"');
  });

  it("renders adjacent links without dropping segments", () => {
    const html = renderInText("[A](https://a.example/)[B](https://b.example/)");
    expect(html.match(/<a /g)?.length).toBe(2);
  });

  it("returns empty output for empty input", () => {
    const html = renderInText("");
    expect(html).toBeDefined();
    expect(html.length).toBeGreaterThan(0);
  });

  it("returns a single link element when the entire string is one link", () => {
    const html = renderInText("[Only](https://only.example/hi)");
    expect(html).toContain('href="https://only.example/hi"');
    expect(html.match(/<a /g)?.length).toBe(1);
  });
});
