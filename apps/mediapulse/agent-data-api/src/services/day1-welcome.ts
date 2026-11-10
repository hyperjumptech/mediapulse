import type { PrismaClient } from "@mediapulse/database";
import { z } from "zod";
import type { GetDay1WelcomeResponse } from "@workspace/agent-data-api-contract";

import {
  loadWelcomeStories,
  type WelcomeStoriesDb,
} from "./day1-welcome-stories.js";
import { parseProfileParties } from "./ticker-profile-parties.js";
import { defaultTickerProfileSource } from "./ticker-profile/ticker-profile-source-default.js";
import type { TickerProfileSource } from "./ticker-profile/ticker-profile-source.js";

export const WELCOME_CLASSIFICATION_LEVELS = 3;

const deliverableEmailSchema = z.string().trim().email();

export type Day1WelcomeDb = Pick<PrismaClient, "day1NewsletterDispatch"> &
  WelcomeStoriesDb;

export const buildWelcomeClassification = (levels: string[]): string[] => {
  const classification: string[] = [];
  for (const level of levels) {
    const trimmed = level.trim();
    const previous = classification[classification.length - 1];
    const repeatsPrevious =
      previous !== undefined &&
      previous.toLowerCase() === trimmed.toLowerCase();
    if (trimmed !== "" && !repeatsPrevious) {
      classification.push(trimmed);
    }
  }

  return classification.slice(0, WELCOME_CLASSIFICATION_LEVELS);
};

const welcomeDispatchSelect = {
  id: true,
  kind: true,
  tickerId: true,
  userTickerId: true,
  language: true,
  welcomeSentAt: true,
  userTicker: {
    select: {
      enabled: true,
      registrationConfirmedAt: true,
      user: { select: { email: true, enabled: true } },
    },
  },
  ticker: {
    select: {
      symbol: true,
      name: true,
    },
  },
} as const;

const nonBlankOrNull = (value: string): string | null =>
  value.trim() === "" ? null : value.trim();

export const getDay1Welcome = async (
  db: Day1WelcomeDb,
  { dispatchId }: { dispatchId: string },
  now: Date = new Date(),
  profileSource: TickerProfileSource = defaultTickerProfileSource,
): Promise<GetDay1WelcomeResponse> => {
  const dispatch = await db.day1NewsletterDispatch.findUnique({
    where: { id: dispatchId },
    select: welcomeDispatchSelect,
  });
  if (dispatch === null || dispatch.kind !== "welcome") {
    return { welcome: null };
  }
  const { userTicker, ticker, language } = dispatch;
  const email = userTicker.user.email;
  const isActiveRecipient =
    userTicker.enabled &&
    userTicker.registrationConfirmedAt !== null &&
    userTicker.user.enabled &&
    deliverableEmailSchema.safeParse(email).success;
  const [profiles, recentStories] = await Promise.all([
    profileSource([ticker.symbol]),
    loadWelcomeStories(db, {
      tickerId: dispatch.tickerId,
      language,
      now,
    }),
  ]);
  const profile = profiles.get(ticker.symbol) ?? null;
  const isEnglish = language === "en";
  const classificationLevels =
    profile === null
      ? []
      : isEnglish
        ? [
            profile.sectorEnglish,
            profile.subSectorEnglish,
            profile.industryEnglish,
          ]
        : [
            profile.sectorIndonesian,
            profile.subSectorIndonesian,
            profile.industryIndonesian,
          ];
  const overview = isEnglish
    ? (profile?.companyOverview ?? "")
    : (profile?.companyOverviewIndonesian ?? "");
  const businessOperation = isEnglish
    ? (profile?.businessOperation ?? "")
    : (profile?.businessOperationIndonesian ?? "");
  const competitors =
    profile === null ? [] : parseProfileParties(profile.competitors);
  const regulators =
    profile === null ? [] : parseProfileParties(profile.regulators);

  return {
    welcome: {
      dispatchId: dispatch.id,
      tickerId: dispatch.tickerId,
      userTickerId: dispatch.userTickerId,
      language,
      sentAt: dispatch.welcomeSentAt?.toISOString() ?? null,
      recipient: isActiveRecipient ? { email: email.trim() } : null,
      tickerSymbol: ticker.symbol,
      companyName: ticker.name,
      overview: nonBlankOrNull(overview),
      businessOperation: nonBlankOrNull(businessOperation),
      classification: buildWelcomeClassification(classificationLevels),
      competitors: competitors.map((party) => party.name.trim()),
      regulators: regulators.map((party) => party.name.trim()),
      recentStories,
    },
  };
};
