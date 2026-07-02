import {
  handleUnsubscribeConfirm,
  unsubscribeConfirmBodySchema,
  unsubscribeConfirmResponseSchema,
} from "@/lib/handle-unsubscribe-confirm";

/**
 * Performs the user-confirmed unsubscribe after the Confirm button is pressed.
 *
 * Kept separate from `POST /api/unsubscribe` (RFC 8058 one-click) so the two POST
 * semantics stay distinct without inspecting request bodies.
 */
export const POST = async (request: Request): Promise<Response> => {
  try {
    const json: unknown = await request.json();
    const body = unsubscribeConfirmBodySchema.parse(json);
    const result = await handleUnsubscribeConfirm(body, request);
    const response = unsubscribeConfirmResponseSchema.parse(result);
    return Response.json(response, { status: 200 });
  } catch {
    return Response.json({ status: "invalid" as const }, { status: 400 });
  }
};
