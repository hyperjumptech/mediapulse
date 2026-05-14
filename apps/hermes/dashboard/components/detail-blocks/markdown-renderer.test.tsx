/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  parseInlineMarkdown,
  parseMarkdownBody,
  renderInlineNodes,
} from "./markdown-renderer";

describe("parseInlineMarkdown", () => {
  it("returns plain text as a single node", () => {
    const nodes = parseInlineMarkdown("just text");

    expect(nodes).toEqual([{ kind: "text", value: "just text" }]);
  });

  it("parses an http link, stripping bold from the label", () => {
    const nodes = parseInlineMarkdown("see [**docs**](https://example.com/x)");

    expect(nodes).toEqual([
      { kind: "text", value: "see " },
      { kind: "link", href: "https://example.com/x", text: "docs" },
    ]);
  });

  it("allows absolute paths as link hrefs", () => {
    const nodes = parseInlineMarkdown("[home](/dashboard)");

    expect(nodes[0]).toEqual({
      kind: "link",
      href: "/dashboard",
      text: "home",
    });
  });

  it("keeps unsafe link syntax as literal text instead of a link", () => {
    const nodes = parseInlineMarkdown("[evil](javascript:alert)");

    expect(nodes).toEqual([
      { kind: "text", value: "[evil](javascript:alert)" },
    ]);
  });

  it("parses **bold** runs as a bold node", () => {
    const nodes = parseInlineMarkdown("normal **strong** end");

    expect(nodes).toEqual([
      { kind: "text", value: "normal " },
      { kind: "bold", children: [{ kind: "text", value: "strong" }] },
      { kind: "text", value: " end" },
    ]);
  });

  it("parses *italic* and _italic_ runs as italic nodes", () => {
    const nodesStar = parseInlineMarkdown("a *italic* b");
    const nodesUnderscore = parseInlineMarkdown("a _italic_ b");

    expect(nodesStar[1]).toEqual({
      kind: "italic",
      children: [{ kind: "text", value: "italic" }],
    });
    expect(nodesUnderscore[1]).toEqual({
      kind: "italic",
      children: [{ kind: "text", value: "italic" }],
    });
  });
});

describe("parseMarkdownBody", () => {
  it("returns an empty list for empty input", () => {
    expect(parseMarkdownBody("")).toEqual([]);
  });

  it("parses a heading with the correct level", () => {
    const blocks = parseMarkdownBody("## Heading two");

    expect(blocks).toEqual([
      {
        kind: "heading",
        level: 2,
        children: [{ kind: "text", value: "Heading two" }],
      },
    ]);
  });

  it("joins consecutive non-empty lines into one paragraph", () => {
    const blocks = parseMarkdownBody("first line\nsecond line\n\nnext");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      kind: "paragraph",
      children: [{ kind: "text", value: "first line second line" }],
    });
  });

  it("parses bullet lists", () => {
    const blocks = parseMarkdownBody("- one\n- two\n- three");

    expect(blocks).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [
          { children: [{ kind: "text", value: "one" }] },
          { children: [{ kind: "text", value: "two" }] },
          { children: [{ kind: "text", value: "three" }] },
        ],
      },
    ]);
  });

  it("parses ordered lists", () => {
    const blocks = parseMarkdownBody("1. one\n2. two");

    expect(blocks).toEqual([
      {
        kind: "list",
        ordered: true,
        items: [
          { children: [{ kind: "text", value: "one" }] },
          { children: [{ kind: "text", value: "two" }] },
        ],
      },
    ]);
  });

  it("normalizes CRLF line endings", () => {
    const blocks = parseMarkdownBody("# Title\r\n\r\nbody");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ kind: "paragraph" });
  });
});

describe("renderInlineNodes", () => {
  it("renders external links with target=_blank and rel=noopener noreferrer", () => {
    const { container } = render(
      <span>
        {renderInlineNodes(
          [{ kind: "link", href: "https://example.com", text: "docs" }],
          "k",
        )}
      </span>,
    );

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders internal links without target or rel", () => {
    const { container } = render(
      <span>
        {renderInlineNodes(
          [{ kind: "link", href: "/dashboard", text: "home" }],
          "k",
        )}
      </span>,
    );

    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBeNull();
    expect(link?.getAttribute("rel")).toBeNull();
  });

  it("renders bold and italic with the matching tags", () => {
    const { container } = render(
      <span>
        {renderInlineNodes(
          [
            { kind: "bold", children: [{ kind: "text", value: "B" }] },
            { kind: "italic", children: [{ kind: "text", value: "I" }] },
          ],
          "k",
        )}
      </span>,
    );

    expect(container.querySelector("strong")?.textContent).toBe("B");
    expect(container.querySelector("em")?.textContent).toBe("I");
  });
});
