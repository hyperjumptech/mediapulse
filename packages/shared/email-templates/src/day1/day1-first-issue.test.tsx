import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { renderNewsletterEmail } from "../index.js";
import Day1FirstIssueIndonesianPreview from "./day1-first-issue-id.js";
import { Day1FirstIssueEmail } from "./day1-first-issue.js";

const withoutTextSeparators = (html: string): string =>
  html.replace(/<!-- -->/g, "");

const renderFirstIssue = async (
  props: Parameters<typeof Day1FirstIssueEmail>[0],
): Promise<{ html: string; text: string }> => {
  const { html, text } = await renderNewsletterEmail({
    variant: "day1-first-issue",
    ...props,
  });

  return { html: withoutTextSeparators(html), text };
};

describe("Day1FirstIssueEmail", () => {
  it("puts a slim brand banner above the first section of the regular newsletter", async () => {
    const { html, text } = await renderFirstIssue(
      Day1FirstIssueEmail.PreviewProps,
    );
    const badgeIndex = html.indexOf(">First issue</span>");
    const welcomeIndex = html.indexOf("Welcome to MediaPulse");
    const firstSectionIndex = html.indexOf("Industry Pulse");

    expect(badgeIndex).toBeGreaterThan(-1);
    expect(welcomeIndex).toBeGreaterThan(badgeIndex);
    expect(firstSectionIndex).toBeGreaterThan(welcomeIndex);
    expect(html).toContain("e-tile");
    expect(html).not.toContain("linear-gradient");
    expect(html).toContain(
      "This is your first ACME briefing. From now on we check ACME news every day at 9:00 AM WIB and send an issue only when there is news worth reading.",
    );
    expect(html).toContain("Fixed broadband carries a flat quarter");
    expect(html).toContain(
      "You are receiving this because you just subscribed to ACME updates.",
    );
    expect(html).toContain("Unsubscribe from MediaPulse: ACME updates");
    expect(text).toContain("This is your first ACME briefing.");
  });

  it("keeps an explicit footer note", async () => {
    const { html } = await renderFirstIssue({
      ...Day1FirstIssueEmail.PreviewProps,
      footerNote: "Custom footer note.",
    });

    expect(html).toContain("Custom footer note.");
    expect(html).not.toContain("you just subscribed");
  });

  it("drops the review time from the note when none is given", async () => {
    const { html } = await renderFirstIssue({
      ...Day1FirstIssueEmail.PreviewProps,
      reviewTimeLabel: undefined,
    });

    expect(html).toContain(
      "This is your first ACME briefing. From now on we check ACME news every day and send an issue only when there is news worth reading.",
    );
  });

  it("localizes the note, the footer and the sections in Indonesian", async () => {
    const withTime = await renderFirstIssue({
      ...Day1FirstIssueEmail.PreviewProps,
      reviewTimeLabel: "09.00 WIB",
      language: "id",
    });
    const withoutTime = await renderFirstIssue({
      ...Day1FirstIssueEmail.PreviewProps,
      reviewTimeLabel: undefined,
      language: "id",
    });

    expect(withTime.html).toContain(">Edisi perdana</span>");
    expect(withTime.html).toContain("Selamat datang di MediaPulse");
    expect(withTime.html).toContain(
      "Ini edisi ACME pertama Anda. Mulai sekarang kami memeriksa berita ACME setiap hari pukul 09.00 WIB",
    );
    expect(withTime.html).toContain("Sorotan Industri");
    expect(withTime.html).toContain(
      "Anda menerima email ini karena Anda baru saja berlangganan pembaruan ACME.",
    );
    expect(withoutTime.html).toContain(
      "Mulai sekarang kami memeriksa berita ACME setiap hari dan mengirim edisi",
    );
  });

  it("shows the note above the title when the body is plain text", async () => {
    const { html } = await renderFirstIssue({
      title: "Your first ACME briefing",
      bodyText: "Plain body with a [link](https://example.com/plain).",
      tickerSymbol: "ACME",
    });
    const welcomeIndex = html.indexOf("Welcome to MediaPulse");
    const titleIndex = html.indexOf("Your first ACME briefing</h1>");

    expect(welcomeIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(welcomeIndex);
    expect(html).toContain("Plain body with a");
  });

  it("leaves the regular newsletter without a welcome note", async () => {
    const { html } = await renderNewsletterEmail({
      title: "ACME daily",
      bodyText: "Plain body.",
      tickerSymbol: "ACME",
    });

    expect(html).not.toContain("Welcome to MediaPulse");
  });
});

describe("Day1FirstIssueIndonesianPreview", () => {
  it("renders the first-issue preview in Indonesian", async () => {
    const html = await render(
      <Day1FirstIssueIndonesianPreview
        {...Day1FirstIssueIndonesianPreview.PreviewProps}
      />,
    );

    expect(html).toContain("Selamat datang di MediaPulse");
    expect(html).toContain("09.00 WIB");
  });
});
