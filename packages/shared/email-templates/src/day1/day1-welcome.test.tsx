import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { renderNewsletterEmail } from "../index.js";
import Day1WelcomeIndonesianPreview from "./day1-welcome-id.js";
import {
  Day1WelcomeEmail,
  MAX_WELCOME_CLASSIFICATION_LEVELS,
  MAX_WELCOME_PEERS,
  MAX_WELCOME_STORIES,
  MAX_WELCOME_STORY_POINTS,
  formatStoryDate,
  type Day1WelcomeStory,
} from "./day1-welcome.js";

const withoutTextSeparators = (html: string): string =>
  html.replace(/<!-- -->/g, "");

const renderWelcome = async (
  props: Parameters<typeof Day1WelcomeEmail>[0],
): Promise<{ html: string; text: string }> => {
  const { html, text } = await renderNewsletterEmail({
    variant: "day1-welcome",
    ...props,
  });

  return { html: withoutTextSeparators(html), text };
};

const buildStory = (index: number, pointCount: number): Day1WelcomeStory => ({
  title: `Story number ${String(index)}`,
  url: `https://example.com/story-${String(index)}`,
  source: "Market Wire",
  points: Array.from(
    { length: pointCount },
    (_, pointIndex) =>
      `Story ${String(index)} point ${String(pointIndex + 1)}.`,
  ),
});

const MINIMAL_PROPS = {
  tickerSymbol: "ACME",
  companyName: "Acme Telekomunikasi",
};

describe("Day1WelcomeEmail", () => {
  it("opens with a neutral header holding only the ticker badge and company name", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const headingIndex = html.indexOf("Acme Telekomunikasi</h1>");
    const classificationIndex = html.indexOf(
      "Infrastructures · Telecommunication · Integrated Telecom",
    );

    expect(html).toContain(
      "A quick look at Acme Telekomunikasi before your first issue",
    );
    expect(html).toContain(">ACME</p>");
    expect(headingIndex).toBeGreaterThan(html.indexOf(">ACME</p>"));
    expect(html).not.toContain("width:80px");
    expect(html).not.toContain("Meet Acme");
    expect(html).not.toContain("Welcome to MediaPulse");
    expect(html).not.toContain("linear-gradient");
    expect(classificationIndex).toBeGreaterThan(
      html.indexOf(">The company</h2>"),
    );
    expect(html).toContain(
      "Here is what you need to know about Acme Telekomunikasi before your first daily issue.",
    );
    expect(html).not.toContain("Thanks for following");
  });

  it("opens with one short sentence and no counts", async () => {
    const full = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const minimal = await renderWelcome(MINIMAL_PROPS);
    const intro =
      "Here is what you need to know about Acme Telekomunikasi before your first daily issue.";

    expect(full.html).toContain(intro);
    expect(minimal.html).toContain(intro);
    expect(full.html).not.toContain("stories read");
    expect(full.html).not.toContain("names tracked");
    expect(full.html).not.toContain("rivals watched");
  });

  it("never speaks as we in its own copy", async () => {
    const english = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const indonesian = await renderWelcome({
      ...Day1WelcomeEmail.PreviewProps,
      language: "id",
    });
    const englishBody = english.text.slice(
      0,
      english.text.indexOf("Have feedback?"),
    );
    const indonesianBody = indonesian.text.slice(
      0,
      indonesian.text.indexOf("Tim MediaPulse"),
    );

    expect(englishBody).not.toMatch(/\bwe\b/i);
    expect(indonesianBody).not.toMatch(/\bkami\b/i);
  });

  it("renders the profile, competitor and regulator pills", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);

    expect(html).toContain(">The company</h2>");
    expect(html).toContain("What Acme Telekomunikasi does.");
    expect(html).toContain("Integrated telecom operator serving mobile");
    expect(html).toContain("Sells prepaid and postpaid mobile plans");
    expect(html).toContain("Who it&#x27;s up against");
    expect(html).toContain("Its competitors and regulators.");
    expect(html).toContain(">Competitors</p>");
    expect(html).toContain(">Contoso Mobile</span>");
    expect(html).toContain(">Northwind Net</span>");
    expect(html).toContain(">Regulators</p>");
    expect(html).toContain(">Financial Services Authority (OJK)</span>");
  });

  it("lists the stories in order without singling one out", async () => {
    const { html, text } = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const firstTitleIndex = html.indexOf("Acme extends home-fiber lead");
    const secondTitleIndex = html.indexOf(
      "Acme holds full-year capex guidance",
    );

    expect(text).toMatch(/What's happening/i);
    expect(html).toContain("The latest news about ACME.");
    expect(html).not.toContain("Lead story");
    expect(firstTitleIndex).toBeGreaterThan(-1);
    expect(secondTitleIndex).toBeGreaterThan(firstTitleIndex);
    expect(html).toContain('href="https://example.com/acme/home-fiber"');
    expect(html).toContain("Market Wire</a> · 3 Oct 2026");
    expect(html).toContain(
      "Added roughly 320,000 home-fiber subscribers in the quarter.",
    );
  });

  it("leaves out the in-the-news chart", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);

    expect(html).not.toContain("Often in the news with");
    expect(html).not.toContain("e-bar");
  });

  it("separates the sign-off from the steps above it", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const signOffIndex = html.indexOf("Thank you,");
    const lastDividerIndex = html.lastIndexOf("<hr", signOffIndex);
    const lastStepIndex = html.lastIndexOf("Every day at", signOffIndex);

    expect(lastDividerIndex).toBeGreaterThan(lastStepIndex);
  });

  it("explains what happens next as two unnumbered steps", async () => {
    const withTime = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const withoutTime = await renderWelcome(MINIMAL_PROPS);

    expect(withTime.html).toContain("What happens next");
    expect(withTime.html).toContain(">Today</p>");
    expect(withTime.html).toContain(
      "This email, to help you get to know the company.",
    );
    expect(withTime.html).not.toContain("e-badge");
    expect(withTime.html).not.toContain("Only when it matters");
    expect(withTime.html).toContain(">Every day at 9:00 AM WIB</p>");
    expect(withTime.html).toContain(
      "You get an issue whenever ACME has news worth your time.",
    );
    expect(withoutTime.html).toContain(">Every day</p>");
  });

  it("renders the sign-off and the newsletter footer", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);

    expect(html).toContain("The MediaPulse Team");
    expect(html).toContain(
      "Have feedback? Reply to this email and we will use it to improve the newsletter.",
    );
    expect(html).toContain(
      "You are receiving this because you subscribed to ACME updates.",
    );
    expect(html).toContain("Unsubscribe from MediaPulse: ACME updates");
    expect(html).toContain("https://example.com/api/unsubscribe?token=preview");
  });

  it("still reads as a welcome when only the ticker and company name are known", async () => {
    const { html, text } = await renderWelcome({
      ...MINIMAL_PROPS,
      tickerSymbol: " ACME ",
    });

    expect(html).toContain("Acme Telekomunikasi</h1>");
    expect(html).toContain(">ACME</p>");
    expect(html).toContain("What happens next");
    expect(html).toContain("The MediaPulse Team");
    expect(html).not.toContain(">The company</h2>");
    expect(html).not.toContain("Who it&#x27;s up against");
    expect(text).not.toMatch(/What's happening/i);
    expect(html).not.toContain("Often in the news with");
    expect(html).not.toMatch(/unsubscribe/i);
  });

  it("drops blank profile values and shows only the groups that have data", async () => {
    const onlyBusinessAndRegulators = await renderWelcome({
      ...MINIMAL_PROPS,
      overview: "   ",
      businessOperation: "Sells mobile plans.",
      classification: ["", "  "],
      competitors: [" "],
      regulators: [" OJK "],
    });
    const onlyOverviewAndCompetitors = await renderWelcome({
      ...MINIMAL_PROPS,
      overview: "Telecom operator.",
      competitors: ["Contoso Mobile"],
    });
    const onlyClassification = await renderWelcome({
      ...MINIMAL_PROPS,
      classification: ["Infrastructures"],
    });

    expect(onlyBusinessAndRegulators.html).toContain(">The company</h2>");
    expect(onlyBusinessAndRegulators.html).toContain("Sells mobile plans.");
    expect(onlyBusinessAndRegulators.html).toContain(">OJK</span>");
    expect(onlyBusinessAndRegulators.html).not.toContain(">Competitors</p>");
    expect(onlyBusinessAndRegulators.html).not.toContain(" · ");
    expect(onlyOverviewAndCompetitors.html).toContain("Telecom operator.");
    expect(onlyOverviewAndCompetitors.html).toContain(">Contoso Mobile</span>");
    expect(onlyOverviewAndCompetitors.html).not.toContain(">Regulators</p>");
    expect(onlyClassification.html).toContain(">The company</h2>");
    expect(onlyClassification.html).toContain(">Infrastructures</p>");
  });

  it("caps chips, stories, points per story and peers", async () => {
    const storyCount = MAX_WELCOME_STORIES + 2;
    const peerCount = MAX_WELCOME_PEERS + 2;
    const levelCount = MAX_WELCOME_CLASSIFICATION_LEVELS + 1;

    const { html } = await renderWelcome({
      ...MINIMAL_PROPS,
      classification: Array.from(
        { length: levelCount },
        (_, index) => `Level ${String(index + 1)}`,
      ),
      competitors: Array.from(
        { length: peerCount },
        (_, index) => `Competitor ${String(index + 1)}`,
      ),
      regulators: Array.from(
        { length: peerCount },
        (_, index) => `Regulator ${String(index + 1)}`,
      ),
      recentStories: Array.from({ length: storyCount }, (_, index) =>
        buildStory(index + 1, MAX_WELCOME_STORY_POINTS + 1),
      ),
    });

    expect(html).toContain(
      `Level ${String(MAX_WELCOME_CLASSIFICATION_LEVELS)}</p>`,
    );
    expect(html).not.toContain(`Level ${String(levelCount)}`);
    expect(html).toContain(`Story number ${String(MAX_WELCOME_STORIES)}`);
    expect(html).not.toContain(
      `Story number ${String(MAX_WELCOME_STORIES + 1)}`,
    );
    expect(html).toContain(
      `Story 1 point ${String(MAX_WELCOME_STORY_POINTS)}.`,
    );
    expect(html).not.toContain(
      `Story 1 point ${String(MAX_WELCOME_STORY_POINTS + 1)}.`,
    );
    expect(html).toContain(`>Competitor ${String(MAX_WELCOME_PEERS)}<`);
    expect(html).not.toContain(`>Competitor ${String(MAX_WELCOME_PEERS + 1)}<`);
    expect(html).toContain(`>Regulator ${String(MAX_WELCOME_PEERS)}<`);
    expect(html).not.toContain(`>Regulator ${String(MAX_WELCOME_PEERS + 1)}<`);
  });

  it("renders a headline-only story with the fallback link label and no date", async () => {
    const { html } = await renderWelcome({
      ...MINIMAL_PROPS,
      recentStories: [
        {
          title: "Acme names a new chief executive",
          url: "https://example.com/acme/ceo",
          publishedAt: "not a date",
          points: [],
        },
      ],
    });

    expect(html).toContain("Acme names a new chief executive");
    expect(html).toContain("Read the full article…</a></p>");
    expect(html).not.toContain("list-style-type:disc");
  });

  it("localizes the chrome and story dates in Indonesian", async () => {
    const { html } = await renderWelcome({
      ...Day1WelcomeEmail.PreviewProps,
      reviewTimeLabel: "09.00 WIB",
      language: "id",
    });

    expect(html).toContain(
      "Gambaran singkat Acme Telekomunikasi sebelum edisi pertama Anda",
    );
    expect(html).toContain("Acme Telekomunikasi</h1>");
    expect(html).not.toContain("Mengenal");
    expect(html).toContain(
      "Berikut yang perlu Anda ketahui tentang Acme Telekomunikasi sebelum edisi harian pertama Anda.",
    );
    expect(html).not.toContain("Sering muncul di berita bersama");
    expect(html).toContain(">Perusahaan</h2>");
    expect(html).toContain("Lawan dan pengawas");
    expect(html).toContain(">Pesaing</p>");
    expect(html).toContain(">Regulator</p>");
    expect(html).toContain("Kabar terbaru");
    expect(html).not.toContain("Berita utama");
    expect(html).toContain("Market Wire</a> · 3 Okt 2026");
    expect(html).toContain("Selanjutnya");
    expect(html).toContain(">Setiap hari pukul 09.00 WIB</p>");
    expect(html).not.toContain("Hanya saat penting");
    expect(html).toContain(
      "Anda menerima edisi setiap kali ada berita ACME yang layak Anda baca.",
    );
    expect(html).toContain("Email ini, agar Anda mengenal perusahaannya.");
    expect(html).not.toContain("Hari yang sepi");
    expect(html).toContain("Tim MediaPulse");
    expect(html).toContain("Berhenti berlangganan pembaruan MediaPulse: ACME");
    expect(html).not.toContain("What happens next");
  });

  it("uses the Indonesian daily step without a review time", async () => {
    const { html } = await renderWelcome({
      ...MINIMAL_PROPS,
      language: "id",
    });

    expect(html).toContain(">Setiap hari</p>");
  });

  it("keeps a dark-mode marker class on every element that carries a color", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const cardStart = html.indexOf('class="email-card');
    const cardHtml = html.slice(cardStart);
    const coloredTags = [
      ...cardHtml.matchAll(/<[a-z0-9]+[^>]*style="[^"]*color:[^"]*"[^>]*>/g),
    ].map((match) => match[0]);
    const unmarkedTags = coloredTags.filter(
      (tag) => !/class="[^"]*\b(e-[a-z-]+|email-card)\b/.test(tag),
    );

    expect(coloredTags.length).toBeGreaterThan(0);
    expect(unmarkedTags).toEqual([]);
  });
});

describe("formatStoryDate", () => {
  it("formats the date in Jakarta time", () => {
    const englishDate = formatStoryDate("2026-10-02T18:30:00.000Z", "en");
    const indonesianDate = formatStoryDate("2026-10-02T18:30:00.000Z", "id");

    expect(englishDate).toBe("3 Oct 2026");
    expect(indonesianDate).toBe("3 Okt 2026");
  });

  it("returns undefined for a missing or unparseable date", () => {
    const missingDate = formatStoryDate(undefined, "en");
    const unparseableDate = formatStoryDate("yesterday-ish", "en");

    expect(missingDate).toBeUndefined();
    expect(unparseableDate).toBeUndefined();
  });
});

describe("Day1WelcomeIndonesianPreview", () => {
  it("renders the welcome preview in Indonesian", async () => {
    const html = await render(
      <Day1WelcomeIndonesianPreview
        {...Day1WelcomeIndonesianPreview.PreviewProps}
      />,
    );

    expect(html).toContain("Acme Telekomunikasi</h1>");
    expect(html).toContain("Infrastruktur");
  });
});
