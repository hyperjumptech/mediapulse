/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";

import * as detailBlocks from "./index";

describe("detail-blocks barrel", () => {
  it("re-exports every public component used by the dashboard", () => {
    expect(typeof detailBlocks.DetailBlockView).toBe("function");
    expect(typeof detailBlocks.DetailBlocksView).toBe("function");
    expect(typeof detailBlocks.DetailBlockKeyValueView).toBe("function");
    expect(typeof detailBlocks.DetailBlockMarkdownView).toBe("function");
    expect(typeof detailBlocks.DetailBlockHtmlPreviewView).toBe("function");
    expect(typeof detailBlocks.DetailBlockSubTableView).toBe("function");
    expect(typeof detailBlocks.DetailBlockSectionHeader).toBe("function");
    expect(typeof detailBlocks.DetailBlockCopyButton).toBe("function");
  });
});
