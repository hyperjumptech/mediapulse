import { prisma } from "@hermes/orchestration-database";
import * as crypto from "node:crypto";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  getDashboardSession,
  getDashboardSessionForRoute,
} from "@/lib/auth-dashboard";
import { apiKeyPurposeSchema } from "@/app/dashboard/api-keys/api-key-purposes";

const bodyValidator = z.object({
  name: z.string().min(1, "Name is required"),
  purpose: apiKeyPurposeSchema.optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
});

type CreateApiKeyHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type CreateApiKeyHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-api-key handler with injectable dependencies for tests.
 * Resolves user by session email, generates a secret key, stores its SHA-256 hash, returns id and raw key once.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that creates an API key and returns id and raw key.
 */
export const createCreateApiKeyHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: CreateApiKeyHandlerDependencies = {}): CreateApiKeyHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const user = await db.user.findUnique({
      where: { email: session.email },
    });
    if (!user) {
      return errorResponse("User not found");
    }

    const rawKey = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await db.aPIKey.create({
      data: {
        name: data.body.name,
        key: hash,
        userId: user.id,
        purpose: data.body.purpose ?? "general",
      },
    });

    return successResponse({ id: apiKey.id, key: rawKey });
  };
};

/**
 * Handles create API key: validates session, resolves user by email, creates key (hash stored), returns id and raw key.
 */
export const handler: CreateApiKeyHandler = createCreateApiKeyHandler();
