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
    const welcomeIndex = html.indexOf("Here is your first ACME issue.");
    const firstSectionIndex = html.indexOf("Industry Pulse");

    expect(badgeIndex).toBeGreaterThan(-1);
    expect(welcomeIndex).toBeGreaterThan(badgeIndex);
    expect(firstSectionIndex).toBeGreaterThan(welcomeIndex);
    expect(html).toContain("e-tile");
    expect(html).not.toContain("linear-gradient");
    expect(html).toContain(
      "Here is your first ACME issue. From now on, you get an issue at 9:00 AM WIB on days when ACME has news worth your time.",
    );
    expect(html).not.toContain("Welcome to MediaPulse");
    expect(html).toContain("Fixed broadband carries a flat quarter");
    expect(html).toContain(
      "You are receiving this because you just subscribed to ACME updates.",
    );
    expect(html).toContain("Unsubscribe from MediaPulse: ACME updates");
    expect(html).not.toContain("We send an issue only when");
    expect(text).toContain("Here is your first ACME issue.");
  });

  it("keeps an explicit footer note", async () => {
    const { html } = await renderFirstIssue({
      ...Day1FirstIssueEmail.PreviewProps,
      footerNote: "Custom footer note.",
    });

    expect(html).toContain("Custom footer note.");
    expect(html).not.toContain("you just subscribed");
  });

  it("leaves the time out of the note when none is given", async () => {
    const { html } = await renderFirstIssue({
      ...Day1FirstIssueEmail.PreviewProps,
      reviewTimeLabel: undefined,
    });

    expect(html).toContain(
      "Here is your first ACME issue. More issues arrive only when ACME has news worth your time.",
    );
  });

  it("localizes the note, the footer and the sections in Indonesian", async () => {
    const { html } = await renderFirstIssue({
      ...Day1FirstIssueEmail.PreviewProps,
      reviewTimeLabel: "09.00 WIB",
      language: "id",
    });
    const withoutTime = await renderFirstIssue({
      ...Day1FirstIssueEmail.PreviewProps,
      reviewTimeLabel: undefined,
      language: "id",
    });

    expect(html).toContain(">Edisi perdana</span>");
    expect(html).toContain(
      "Ini edisi ACME pertama Anda. Mulai sekarang, Anda menerima edisi pukul 09.00 WIB pada hari ada berita ACME yang layak Anda baca.",
    );
    expect(withoutTime.html).toContain(
      "Ini edisi ACME pertama Anda. Edisi berikutnya datang hanya saat ada berita ACME yang layak Anda baca.",
    );
    expect(html).not.toContain("Selamat datang di MediaPulse");
    expect(html).toContain("Sorotan Industri");
    expect(html).toContain(
      "Anda menerima email ini karena Anda baru saja berlangganan pembaruan ACME.",
    );
  });

  it("shows the note above the title when the body is plain text", async () => {
    const { html } = await renderFirstIssue({
      title: "Your first ACME briefing",
      bodyText: "Plain body with a [link](https://example.com/plain).",
      tickerSymbol: "ACME",
    });
    const welcomeIndex = html.indexOf("Here is your first ACME issue.");
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

    expect(html).not.toContain("Here is your first ACME issue.");
  });
});

describe("Day1FirstIssueIndonesianPreview", () => {
  it("renders the first-issue preview in Indonesian", async () => {
    const html = await render(
      <Day1FirstIssueIndonesianPreview
        {...Day1FirstIssueIndonesianPreview.PreviewProps}
      />,
    );

    expect(html).toContain("Ini edisi ACME pertama Anda.");
    expect(html).toContain("09.00 WIB");
  });
});
