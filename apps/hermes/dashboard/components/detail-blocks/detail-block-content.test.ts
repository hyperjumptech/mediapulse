import type { DetailBlock } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { detailBlockHasContent } from "./detail-block-content";

const keyValue: DetailBlock = {
  type: "keyValue",
  rows: [
    { field: "name", label: "Name" },
    { field: "reason", label: "Reason" },
  ],
};

describe("detailBlockHasContent", () => {
  it("counts a key-value block only when a row has a value", () => {
    expect(detailBlockHasContent(keyValue, { name: "", reason: null })).toBe(
      false,
    );
    expect(detailBlockHasContent(keyValue, { name: "Alpha" })).toBe(true);
    expect(detailBlockHasContent(keyValue, { reason: false })).toBe(true);
  });

  it("counts a markdown block only when its body has text", () => {
    const markdown: DetailBlock = { type: "markdown", field: "body" };

    expect(detailBlockHasContent(markdown, { body: "  " })).toBe(false);
    expect(detailBlockHasContent(markdown, { body: "Hello" })).toBe(true);
  });

  it("counts a panel when any child has content", () => {
    const panel: DetailBlock = {
      type: "panel",
      label: "Run",
      blocks: [keyValue, { type: "markdown", field: "body" }],
    };

    expect(detailBlockHasContent(panel, {})).toBe(false);
    expect(detailBlockHasContent(panel, { body: "Notes" })).toBe(true);
  });

  it("always counts blocks that render their own empty state", () => {
    const subTable: DetailBlock = {
      type: "subTable",
      field: "rows",
      columns: [{ field: "title", label: "Title", type: "text" }],
    };

    expect(detailBlockHasContent(subTable, { rows: [] })).toBe(true);
  });
});
