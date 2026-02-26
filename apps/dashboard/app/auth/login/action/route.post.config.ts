import { z } from "zod";
import {
  createRequestValidator,
  successResponse,
  errorResponse,
  HandlerFunc,
} from "route-action-gen/lib";
import { prismaClient } from "@workspace/database/client";
import bcrypt from "bcrypt";

const bodyValidator = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  name: z.string(),
  email: z.string().email(),
  id: z.string(),
});

export const handler: HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
> = async (data) => {
  const { email, password } = data.body;

  const user = await prismaClient.user.findUnique({
    where: { email },
  });

  if (!user) {
    return errorResponse("Invalid credentials");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return errorResponse("Invalid credentials");
  }

  return successResponse({
    name: user.name,
    email: user.email,
    id: user.id,
  });
};
