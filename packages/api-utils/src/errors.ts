import type { Context } from "hono";

export function notFound(context: Context, message = "Not found") {
  return context.json({ message }, 404);
}

export function internalError(context: Context, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("API error:", message);
  return context.json({ message: "Internal Server Error" }, 500);
}
