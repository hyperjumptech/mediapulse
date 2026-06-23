import { handleConfirmLink } from "@/lib/handle-confirm-link";

/**
 * Handles browser subscription confirmation links from outbound email.
 */
export const GET = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  return handleConfirmLink(token);
};
