import { prisma as mediapulsePrisma } from "@mediapulse/database";

export async function processRegistration({
  email,
  tickerSymbol,
  name,
}: {
  email: string;
  tickerSymbol: string;
  name?: string | null;
}) {
  const ticker = await mediapulsePrisma.ticker.findUnique({
    where: { symbol: tickerSymbol },
  });

  if (!ticker) {
    return {
      tickerKnown: false,
      userTickerId: undefined,
      confirmationNeeded: false,
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
  let confirmationNeeded: boolean;
  let subscriptionChanged: boolean;

  if (existingSubscription) {
    userTickerId = existingSubscription.id;
    // If it exists, but was disabled, we enable it. That counts as a change.
    subscriptionChanged = !existingSubscription.enabled;
    // It's conceptually needed if never confirmed, or if it was re-enabled (depending on product requirements, typically if it hasn't been confirmed, or we want double opt-in on re-enable, but implementation plan says:
    // "if registrationConfirmedAt === null (or marker false)")
    confirmationNeeded = existingSubscription.registrationConfirmedAt === null;

    if (!existingSubscription.enabled) {
      await mediapulsePrisma.userTicker.update({
        where: { id: existingSubscription.id },
        data: { enabled: true },
      });
    }
  } else {
    // New subscription
    const newSubscription = await mediapulsePrisma.userTicker.create({
      data: {
        userId: user.id,
        tickerId: ticker.id,
        enabled: true,
      },
    });
    userTickerId = newSubscription.id;
    subscriptionChanged = true;
    confirmationNeeded = true;
  }

  return {
    tickerKnown: true,
    userTickerId,
    confirmationNeeded,
    subscriptionChanged,
  };
}

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
