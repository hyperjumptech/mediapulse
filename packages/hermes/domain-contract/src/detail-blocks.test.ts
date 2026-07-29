/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  detailBlockSchema,
  detailBlockSectionRuleSchema,
} from "./detail-blocks";

describe("detailBlockSchema", () => {
  it("parses a keyValue block with rows", () => {
    const parsed = detailBlockSchema.parse({
      type: "keyValue",
      label: "Metadata",
      rows: [
        { field: "subject", label: "Subject" },
        {
          field: "tickerName",
          label: "Ticker",
          linkTemplate: "/dashboard/{integrationId}/tickers/{tickerId}",
        },
      ],
    });

    expect(parsed.type).toBe("keyValue");
    if (parsed.type !== "keyValue") return;
    expect(parsed.rows).toHaveLength(2);
  });

  it("parses a markdown block with clampChars and copyAction", () => {
    const parsed = detailBlockSchema.parse({
      type: "markdown",
      field: "newsletter.content",
      clampChars: 4000,
      copyAction: true,
    });

    expect(parsed.type).toBe("markdown");
    if (parsed.type !== "markdown") return;
    expect(parsed.clampChars).toBe(4000);
    expect(parsed.copyAction).toBe(true);
  });

  it("parses an htmlPreview block", () => {
    const parsed = detailBlockSchema.parse({
      type: "htmlPreview",
      field: "emailPreviewHtml",
      label: "Preview",
    });

    expect(parsed.type).toBe("htmlPreview");
    if (parsed.type !== "htmlPreview") return;
    expect(parsed.field).toBe("emailPreviewHtml");
  });

  it("parses a subTable block with linkColumn", () => {
    const parsed = detailBlockSchema.parse({
      type: "subTable",
      field: "citations",
      columns: [
        { field: "title", label: "Title" },
        {
          field: "url",
          label: "URL",
          linkTemplate: "{url}",
          linkExternal: true,
        },
      ],
      captionTemplate: "Citations ({citations.length} unique)",
    });

    expect(parsed.type).toBe("subTable");
    if (parsed.type !== "subTable") return;
    expect(parsed.columns).toHaveLength(2);
  });

  it("parses a subTable block with pageSize", () => {
    const parsed = detailBlockSchema.parse({
      type: "subTable",
      field: "recipients",
      columns: [{ field: "displayName", label: "Recipient" }],
      pageSize: 10,
    });

    expect(parsed.type).toBe("subTable");
    if (parsed.type !== "subTable") return;
    expect(parsed.pageSize).toBe(10);
  });

  it("parses a subTable list column with its item shape", () => {
    const parsed = detailBlockSchema.parse({
      type: "subTable",
      field: "sources",
      columns: [
        {
          field: "sectionScores",
          label: "Score",
          type: "list",
          listItem: {
            field: "scoreLine",
            colorField: "scoreVariant",
            descriptionField: "reason",
          },
        },
      ],
    });

    expect(parsed.type).toBe("subTable");
    if (parsed.type !== "subTable") return;
    expect(parsed.columns[0]?.type).toBe("list");
    expect(parsed.columns[0]?.listItem?.field).toBe("scoreLine");
  });

  it("rejects a list column that omits listItem", () => {
    expect(() =>
      detailBlockSchema.parse({
        type: "subTable",
        field: "sources",
        columns: [{ field: "sectionScores", label: "Score", type: "list" }],
      }),
    ).toThrow();
  });

  it("rejects a non-positive pageSize on a subTable block", () => {
    expect(() =>
      detailBlockSchema.parse({
        type: "subTable",
        field: "recipients",
        columns: [{ field: "displayName", label: "Recipient" }],
        pageSize: 0,
      }),
    ).toThrow();
  });

  it("parses a tabs block with one leaf block per tab", () => {
    const parsed = detailBlockSchema.parse({
      type: "tabs",
      label: "Content",
      tabs: [
        {
          label: "Body",
          block: { type: "markdown", field: "content" },
        },
        {
          label: "Email preview",
          block: { type: "htmlPreview", field: "emailPreviewHtml" },
        },
      ],
    });

    expect(parsed.type).toBe("tabs");
    if (parsed.type !== "tabs") return;
    expect(parsed.tabs).toHaveLength(2);
    expect(parsed.tabs[0]?.label).toBe("Body");
    expect(parsed.tabs[0]?.block.type).toBe("markdown");
    expect(parsed.tabs[1]?.block.type).toBe("htmlPreview");
  });

  it("rejects a tabs block whose tab list is empty", () => {
    expect(() => detailBlockSchema.parse({ type: "tabs", tabs: [] })).toThrow();
  });

  it("rejects a tabs block that nests another tabs block", () => {
    expect(() =>
      detailBlockSchema.parse({
        type: "tabs",
        tabs: [
          {
            label: "Outer",
            block: {
              type: "tabs",
              tabs: [
                {
                  label: "Inner",
                  block: { type: "markdown", field: "content" },
                },
              ],
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects unknown block type", () => {
    expect(() =>
      detailBlockSchema.parse({ type: "unknown", field: "foo" }),
    ).toThrow();
  });

  it("rejects empty rows on a keyValue block", () => {
    expect(() =>
      detailBlockSchema.parse({ type: "keyValue", rows: [] }),
    ).toThrow();
  });
});

describe("detailBlockSectionRuleSchema", () => {
  it("parses a section rule", () => {
    const parsed = detailBlockSectionRuleSchema.parse({
      when: "deliveryDelivered < deliveryEnabledAtSendTime",
      badge: "warning",
      label: "partial delivery",
    });

    expect(parsed.badge).toBe("warning");
  });

  it("rejects unknown badge variant", () => {
    expect(() =>
      detailBlockSectionRuleSchema.parse({
        when: "true",
        badge: "weird",
        label: "x",
      }),
    ).toThrow();
  });
});
