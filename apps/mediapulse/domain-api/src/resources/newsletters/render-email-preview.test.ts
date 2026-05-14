import { describe, expect, it, vi } from "vitest";

import { renderEmailPreview } from "./render-email-preview";

describe("renderEmailPreview", () => {
  it("returns the renderer's HTML on success", async () => {
    const renderHtml = vi
      .fn()
      .mockResolvedValue({ html: "<html><body>Preview</body></html>" });

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-1",
        subject: "Apple weekly digest",
        bodyText: "Hello",
        tickerSymbol: "AAPL",
      },
      { renderHtml },
    );

    expect(html).toBe("<html><body>Preview</body></html>");
    expect(renderHtml).toHaveBeenCalledTimes(1);
    expect(renderHtml).toHaveBeenCalledWith({
      title: "Apple weekly digest",
      bodyText: "Hello",
      tickerSymbol: "AAPL",
      unsubscribeUrl: "https://example.com/preview/unsubscribe",
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
        bodyText: "Body",
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
        bodyText: "Body",
        tickerSymbol: "AAPL",
      },
      { renderHtml },
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("does not throw when the newsletter has empty optional fields", async () => {
    const renderHtml = vi.fn().mockResolvedValue({ html: "<html></html>" });

    const html = await renderEmailPreview(
      {
        newsletterId: "nl-2",
        subject: "",
        bodyText: "",
        tickerSymbol: "",
      },
      { renderHtml },
    );

    expect(html).toBe("<html></html>");
  });
});
