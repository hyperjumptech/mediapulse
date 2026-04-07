import { z } from "zod";
import {
  createRequestValidator,
  type HandlerFunc,
  successResponse,
  errorResponse,
} from "route-action-gen/lib";
import { prisma as defaultPrisma, Prisma } from "@mediapulse/database";

export const requestValidator = createRequestValidator({
  body: z.object({
    email: z.string().email("Invalid email address"),
    name: z.string().optional(),
    tickerSymbol: z.string().min(1, "Ticker is required"),
  }),
});

export const responseValidator = z.object({
  success: z.boolean(),
  message: z.string(),
});

type RegistrationDependencies = {
  prisma?: typeof defaultPrisma;
};

type RegistrationHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the handler for processing user registrations.
 *
 * @param dependencies - Injectable Prisma client for database operations.
 * @returns Server action handler that manages user and subscription creation.
 */
export const createRegistrationHandler = ({
  prisma = defaultPrisma,
}: RegistrationDependencies = {}): RegistrationHandler => {
  return async (data) => {
    const { email, name, tickerSymbol } = data.body;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedSymbol = tickerSymbol.trim().toUpperCase();

    try {
      const tickerArgs = {
        where: { symbol: normalizedSymbol },
      } satisfies Prisma.TickerFindUniqueArgs;

      const ticker = await prisma.ticker.findUnique(tickerArgs);

      if (!ticker) {
        return errorResponse("Ticker not found");
      }

      // Use a transaction for atomic user and subscription creation
      const result = await prisma.$transaction(async (tx) => {
        const userUpsertArgs = {
          where: { email: normalizedEmail },
          update: {}, // Don't override existing names
          create: { email: normalizedEmail, name },
        } satisfies Prisma.MediapulseUserUpsertArgs;

        // Find or create user
        const user = await tx.mediapulseUser.upsert(userUpsertArgs);

        const userTickerUpsertArgs = {
          where: {
            userId_tickerId: {
              userId: user.id,
              tickerId: ticker.id,
            },
          },
          update: {
            enabled: true,
          },
          create: {
            userId: user.id,
            tickerId: ticker.id,
            enabled: true,
          },
        } satisfies Prisma.UserTickerUpsertArgs;

        // Create or enable subscription
        await tx.userTicker.upsert(userTickerUpsertArgs);

        return { user, ticker };
      });

      return successResponse({
        success: true,
        message: `Successfully registered for ${result.ticker.symbol} newsletter!`,
      });
    } catch {
      return errorResponse("Internal server error during registration");
    }
  };
};

/**
 * Handles user registration: creates/updates user and enables ticker subscription.
 * Uses a transaction to ensure both user and subscription are created atomically.
 */
export const handler: RegistrationHandler = createRegistrationHandler();
