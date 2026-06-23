import {
  confirmRequestBodySchema,
  confirmRequestResponseSchema,
  handleConfirmRequest,
} from "@/lib/handle-confirm-request";

/**
 * Accepts a web signup confirmation email request.
 */
export const POST = async (request: Request): Promise<Response> => {
  try {
    const json: unknown = await request.json();
    const body = confirmRequestBodySchema.parse(json);
    const result = await handleConfirmRequest(body, request);
    const response = confirmRequestResponseSchema.parse(result);
    return Response.json(response, { status: 200 });
  } catch {
    return Response.json(
      { ok: false, error: "Invalid request" },
      { status: 400 },
    );
  }
};
