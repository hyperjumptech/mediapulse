import type { Context } from "hono";
import { ZodError } from "zod";

export function notFound(
  context: Context,
  message = "Not found",
): unknown {
  return context.json({ message }, 404);
}

export function internalError(
  context: Context,
  error: unknown,
): unknown {
  if (error instanceof Response) {
    return error;
  }

  if (error instanceof ZodError) {
    return context.json({ message: "Bad Request", errors: error.issues }, 400);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error("API error:", message);

  return context.json({ message: "Internal Server Error" }, 500);
}
