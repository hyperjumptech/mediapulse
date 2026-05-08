import { prisma as mediapulsePrisma } from "@mediapulse/database";
import { verifyUnsubscribeToken } from "@workspace/utils";
import type {
  UserRegistrationUnsubscribeMethod,
  UserRegistrationUnsubscribeResponse,
} from "@workspace/agent-data-api-contract";

/**
 * Processes a new or returning user registration for a given ticker.
 * Creates or updates the user and their subscription, then returns outcome flags
 * that the agent uses to decide whether to send an opt-in email.
 *
 * @returns `tickerKnown` – whether the symbol exists in the database.
 * @returns `userTickerId` – the UserTicker row id (undefined when ticker is unknown).
 * @returns `isNewSubscription` – true when a confirmation email should be sent.
 * @returns `subscriptionChanged` – true when the subscription state was modified.
 */
export async function processRegistration({
  email,
  tickerSymbol,
  name,
  confirmed,
}: {
  email: string;
  tickerSymbol: string;
  name?: string | null;
  confirmed?: boolean;
}) {
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
      userId_tickerId: {
        userId: user.id,
        tickerId: ticker.id,
      },
    },
  });

  let userTickerId: string;
  let isNewSubscription: boolean;
  let subscriptionChanged: boolean;

  const registrationConfirmedAt = confirmed ? new Date() : null;

  if (existingSubscription) {
    userTickerId = existingSubscription.id;
    // If it exists, but was disabled, we enable it. That counts as a change.
    subscriptionChanged = !existingSubscription.enabled;
    // It's conceptually needed if never confirmed, or if it was re-enabled
    isNewSubscription = existingSubscription.registrationConfirmedAt === null;

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
        registrationConfirmedAt: confirmed ? new Date() : null,
      },
    });
    userTickerId = newSubscription.id;
    subscriptionChanged = true;
    isNewSubscription = true;
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
export async function confirmRegistration({
  userTickerId,
}: {
  userTickerId: string;
}) {
  await mediapulsePrisma.userTicker.update({
    where: { id: userTickerId },
    data: {
      registrationConfirmedAt: new Date(),
      enabled: true,
    },
  });
  return { success: true };
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
