import { describe, expect, it, vi } from "vitest";

import { renderEmailPreview } from "./render-email-preview";

const DOCUMENT_BODY = JSON.stringify({
  version: 1,
  sections: [
    {
      key: "industry-pulse",
      articles: [
        {
          title: "Fixed broadband carries a flat quarter",
          source: "Market Wire",
          url: "https://example.com/broadband",
          points: ["Net adds carried sector revenue growth."],
        },
      ],
    },
  ],
});

describe("renderEmailPreview", () => {
  it("returns the renderer's HTML on success", async () => {
    const renderHtml = vi
      .fn()
      .mockResolvedValue({ html: "<html><body>Preview</body></html>" });

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-1",
        subject: "Apple weekly digest",
        bodyText: DOCUMENT_BODY,
        tickerSymbol: "AAPL",
      },
      { renderHtml },
    );

    expect(html).toBe("<html><body>Preview</body></html>");
    expect(renderHtml).toHaveBeenCalledTimes(1);
    expect(renderHtml).toHaveBeenCalledWith({
      title: "Apple weekly digest",
      bodyText: DOCUMENT_BODY,
      tickerSymbol: "AAPL",
      unsubscribeUrl: "https://example.com/preview/unsubscribe",
      language: "en",
    });
  });

  it("strips the Pulse prefix from the stored subject for the email body title", async () => {
    const renderHtml = vi
      .fn()
      .mockResolvedValue({ html: "<html><body>Preview</body></html>" });

    await renderEmailPreview(
      {
        newsletterId: "nl-1",
        subject: "AAPL Pulse: Apple weekly digest",
        bodyText: DOCUMENT_BODY,
        tickerSymbol: "AAPL",
      },
      { renderHtml },
    );

    expect(renderHtml).toHaveBeenCalledWith({
      title: "Apple weekly digest",
      bodyText: DOCUMENT_BODY,
      tickerSymbol: "AAPL",
      unsubscribeUrl: "https://example.com/preview/unsubscribe",
      language: "en",
    });
  });

  it("passes the requested language through to the renderer", async () => {
    const renderHtml = vi
      .fn()
      .mockResolvedValue({ html: "<html><body>Pratinjau</body></html>" });

    await renderEmailPreview(
      {
        newsletterId: "nl-1",
        subject: "TLKM Pulse: Ringkasan mingguan",
        bodyText: DOCUMENT_BODY,
        tickerSymbol: "TLKM",
        language: "id",
      },
      { renderHtml },
    );

    expect(renderHtml).toHaveBeenCalledWith({
      title: "Ringkasan mingguan",
      bodyText: DOCUMENT_BODY,
      tickerSymbol: "TLKM",
      unsubscribeUrl: "https://example.com/preview/unsubscribe",
      language: "id",
    });
  });

  it("returns a safe placeholder on render error and logs a warning", async () => {
    const renderHtml = vi
      .fn()
      .mockRejectedValue(new Error("Template exploded"));
    const warn = vi.fn();

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-err",
        subject: "Subject",
        bodyText: DOCUMENT_BODY,
        tickerSymbol: "AAPL",
      },
      { renderHtml, logger: { warn } },
    );

    expect(html).toContain("<p>Email preview unavailable");
    expect(html).toContain("Template exploded");
    expect(warn).toHaveBeenCalledTimes(1);
    const arg = warn.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      newsletterId: "nl-err",
      error: "Template exploded",
    });
  });

  it("escapes HTML in error messages so the placeholder cannot inject markup", async () => {
    const renderHtml = vi
      .fn()
      .mockRejectedValue(new Error("<script>alert(1)</script>"));

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-x",
        subject: "Subject",
        bodyText: DOCUMENT_BODY,
        tickerSymbol: "AAPL",
      },
      { renderHtml },
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("shows a format notice for a newsletter stored in the legacy wire format", async () => {
    const renderHtml = vi.fn();

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-legacy",
        subject: "AAPL Pulse: Old issue",
        bodyText:
          "MP_NEWSLETTER\n\nBEGIN industry-pulse\nDISPLAY_HEADING\nOld\nPROSE\nOld body.\nEND\n",
        tickerSymbol: "AAPL",
      },
      { renderHtml },
    );

    expect(html).toContain("before the current content format");
    expect(html).not.toContain("MP_NEWSLETTER");
    expect(renderHtml).not.toHaveBeenCalled();
  });

  it("names the failing fields when the body is JSON but breaks the format", async () => {
    const renderHtml = vi.fn();
    const warn = vi.fn();

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-invalid",
        subject: "TLKM Pulse: Ringkasan",
        bodyText: JSON.stringify({
          version: 1,
          sections: [
            {
              key: "industry-pulse",
              articles: [
                {
                  title: "Judul",
                  url: "javascript:alert(1)",
                  points: ["Ringkas."],
                },
              ],
            },
          ],
        }),
        tickerSymbol: "TLKM",
        language: "id",
      },
      { renderHtml, logger: { warn } },
    );

    expect(html).toContain("not a valid newsletter document");
    expect(html).not.toContain("before the current content format");
    expect(html).toContain("sections.0.articles.0.url");
    expect(renderHtml).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("renders a body whose point overshoots the length budget", async () => {
    const renderHtml = vi
      .fn()
      .mockResolvedValue({ html: "<html><body>Pratinjau</body></html>" });
    const overLongBody = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "Judul",
              url: "https://example.com/a",
              points: ["a".repeat(115)],
            },
          ],
        },
      ],
    });

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-long",
        subject: "TLKM Pulse: Ringkasan",
        bodyText: overLongBody,
        tickerSymbol: "TLKM",
        language: "id",
      },
      { renderHtml },
    );

    expect(html).toBe("<html><body>Pratinjau</body></html>");
    expect(renderHtml).toHaveBeenCalledTimes(1);
  });

  it("shows the format notice rather than throwing on an empty body", async () => {
    const renderHtml = vi.fn();

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-2",
        subject: "",
        bodyText: "",
        tickerSymbol: "",
      },
      { renderHtml },
    );

    expect(html).toContain("before the current content format");
    expect(renderHtml).not.toHaveBeenCalled();
  });
});
