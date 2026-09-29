import { prisma as mediapulsePrisma } from "@mediapulse/database";
import {
  verifyRegistrationConfirmToken,
  verifyUnsubscribeToken,
} from "@workspace/utils";
import type {
  UserRegistrationConfirmSubscriptionResponse,
  UserRegistrationLanguage,
  UserRegistrationUnsubscribeMethod,
  UserRegistrationUnsubscribeResponse,
} from "@workspace/agent-data-api-contract";

import type { Day1Activation } from "./day1-newsletter-dispatch.js";
import { notifySubscriptionActivated } from "./day1-newsletter-dispatch-default.js";

export type UserRegistrationDeps = {
  onSubscriptionActivated?: (activation: Day1Activation) => void;
};

const isActiveSubscription = (subscription: {
  enabled: boolean;
  registrationConfirmedAt: Date | null;
}): boolean =>
  subscription.enabled && subscription.registrationConfirmedAt !== null;

/**
 * Processes a new or returning user registration for a given ticker.
 * Creates or updates the user and their subscription, then returns outcome flags
 * that the agent uses to decide whether to send an opt-in email.
 *
 * Language is per-subscription, so a user may hold separate subscriptions for the same
 * ticker in different languages. The lookup and create are therefore keyed by language.
 *
 * @returns `tickerKnown` – whether the symbol exists in the database.
 * @returns `userTickerId` – the UserTicker row id (undefined when ticker is unknown).
 * @returns `isNewSubscription` – true when a confirmation email should be sent.
 * @returns `subscriptionChanged` – true when the subscription state was modified.
 */
export async function processRegistration(
  {
    email,
    tickerSymbol,
    name,
    language = "en",
    confirmed,
  }: {
    email: string;
    tickerSymbol: string;
    name?: string | null;
    language?: UserRegistrationLanguage;
    confirmed?: boolean;
  },
  {
    onSubscriptionActivated = notifySubscriptionActivated,
  }: UserRegistrationDeps = {},
) {
  const normalizedSymbol = tickerSymbol.trim().toUpperCase();

  const ticker = await mediapulsePrisma.ticker.findUnique({
    where: { symbol: normalizedSymbol },
  });

  if (!ticker) {
    return {
      tickerKnown: false,
      userTickerId: undefined,
      isNewSubscription: false,
      subscriptionChanged: false,
    };
  }

  // Find or create user
  const user = await mediapulsePrisma.mediapulseUser.upsert({
    where: { email },
    update: {}, // Don't override existing names
    create: { email, name },
  });

  // Find existing subscription explicitly first to determine `subscriptionChanged` properly
  const existingSubscription = await mediapulsePrisma.userTicker.findUnique({
    where: {
      userId_tickerId_language: {
        userId: user.id,
        tickerId: ticker.id,
        language,
      },
    },
  });

  let userTickerId: string;
  let isNewSubscription: boolean;
  let subscriptionChanged: boolean;
  let activated: boolean;

  const registrationConfirmedAt = confirmed ? new Date() : null;

  if (existingSubscription) {
    userTickerId = existingSubscription.id;
    // If it exists, but was disabled, we enable it. That counts as a change.
    subscriptionChanged = !existingSubscription.enabled;
    // It's conceptually needed if never confirmed, or if it was re-enabled
    isNewSubscription = existingSubscription.registrationConfirmedAt === null;

    const confirmsNow = Boolean(
      confirmed && !existingSubscription.registrationConfirmedAt,
    );
    activated =
      !isActiveSubscription(existingSubscription) &&
      (existingSubscription.registrationConfirmedAt !== null || confirmsNow);

    if (
      !existingSubscription.enabled ||
      (confirmed && !existingSubscription.registrationConfirmedAt)
    ) {
      await mediapulsePrisma.userTicker.update({
        where: { id: existingSubscription.id },
        data: {
          enabled: true,
          ...(confirmed && !existingSubscription.registrationConfirmedAt
            ? { registrationConfirmedAt: new Date() }
            : {}),
        },
      });
    }
  } else {
    // New subscription
    const newSubscription = await mediapulsePrisma.userTicker.create({
      data: {
        userId: user.id,
        tickerId: ticker.id,
        enabled: true,
        language,
        registrationConfirmedAt: confirmed ? new Date() : null,
      },
    });
    userTickerId = newSubscription.id;
    subscriptionChanged = true;
    isNewSubscription = true;
    activated = Boolean(confirmed);
  }

  if (activated) {
    onSubscriptionActivated({ userTickerId });
  }

  return {
    tickerKnown: true,
    userTickerId,
    isNewSubscription,
    subscriptionChanged,
  };
}

/**
 * Confirms a user's subscription by recording the confirmation timestamp
 * and ensuring the subscription remains enabled.
 */
export async function confirmRegistration(
  {
    userTickerId,
  }: {
    userTickerId: string;
  },
  {
    onSubscriptionActivated = notifySubscriptionActivated,
  }: UserRegistrationDeps = {},
) {
  const existingSubscription = await mediapulsePrisma.userTicker.findUnique({
    where: { id: userTickerId },
    select: { enabled: true, registrationConfirmedAt: true },
  });
  await mediapulsePrisma.userTicker.update({
    where: { id: userTickerId },
    data: {
      registrationConfirmedAt: new Date(),
      enabled: true,
    },
  });
  const wasActive =
    existingSubscription != null && isActiveSubscription(existingSubscription);
  if (!wasActive) {
    onSubscriptionActivated({ userTickerId });
  }

  return { success: true };
}

/**
 * Processes a web signup from the user-registration Next.js app.
 * Creates an unconfirmed subscription when the ticker is known.
 *
 * @param params - Signup fields from the public registration form.
 * @returns Outcome flags for the server-side confirm email flow.
 */
export async function processWebSignup(
  {
    email,
    tickerSymbol,
    name,
    language = "en",
  }: {
    email: string;
    tickerSymbol: string;
    name?: string | null;
    language?: UserRegistrationLanguage;
  },
  deps: UserRegistrationDeps = {},
) {
  const result = await processRegistration(
    {
      email,
      tickerSymbol,
      name,
      language,
      confirmed: false,
    },
    deps,
  );

  return {
    ok: true as const,
    tickerKnown: result.tickerKnown,
    userTickerId: result.userTickerId,
    isNewSubscription: result.isNewSubscription,
  };
}

/**
 * Confirms a subscription using a signed registration confirmation token.
 *
 * @param params - Token verification inputs.
 * @param params.token - Signed confirmation token from the email link.
 * @param params.secret - Shared HMAC secret.
 * @returns Normalized confirmation outcome for API callers.
 */
export async function processConfirmSubscription(
  {
    token,
    secret,
  }: {
    token: string;
    secret: string;
  },
  deps: UserRegistrationDeps = {},
): Promise<UserRegistrationConfirmSubscriptionResponse> {
  const result = verifyRegistrationConfirmToken(token, secret);
  if (!result.valid) {
    if (result.reason === "expired") {
      return { status: "expired" };
    }
    return { status: "invalid" };
  }

  const userTicker = await mediapulsePrisma.userTicker.findUnique({
    where: { id: result.userTickerId },
    include: { ticker: true, user: true },
  });
  const displaySymbol = userTicker?.ticker?.symbol ?? result.tickerSymbol;

  if (!userTicker) {
    return { status: "invalid", displaySymbol };
  }

  if (userTicker.registrationConfirmedAt != null) {
    return { status: "already_confirmed", displaySymbol };
  }

  await confirmRegistration({ userTickerId: result.userTickerId }, deps);

  return {
    status: "confirmed",
    displaySymbol,
    email: userTicker.user.email,
  };
}

/**
 * Applies an unsubscribe token to disable a user subscription.
 *
 * @param params - Token verification inputs.
 * @param params.token - Signed unsubscribe token.
 * @param params.secret - Shared HMAC secret.
 * @param params.method - Unsubscribe interaction method for audit.
 * @returns Normalized unsubscribe outcome for API callers.
 */
export async function processUnsubscribe({
  token,
  secret,
  method,
}: {
  token: string;
  secret: string;
  method: UserRegistrationUnsubscribeMethod;
}): Promise<UserRegistrationUnsubscribeResponse> {
  const result = verifyUnsubscribeToken(token, secret);
  if (!result.valid) {
    if (result.reason === "expired") {
      return { status: "expired" };
    }
    return { status: "invalid" };
  }

  const userTicker = await mediapulsePrisma.userTicker.findUnique({
    where: { id: result.userTickerId },
    include: { ticker: true },
  });
  const displaySymbol = userTicker?.ticker?.symbol ?? result.tickerSymbol;

  if (!userTicker) {
    return { status: "not_found", displaySymbol };
  }

  if (!userTicker.enabled && userTicker.unsubscribedAt != null) {
    return { status: "already_unsubscribed", displaySymbol };
  }

  await mediapulsePrisma.userTicker.update({
    where: { id: result.userTickerId },
    data: {
      enabled: false,
      unsubscribedAt: new Date(),
      unsubscribeMethod: method,
    },
  });

  return { status: "unsubscribed", displaySymbol };
}
