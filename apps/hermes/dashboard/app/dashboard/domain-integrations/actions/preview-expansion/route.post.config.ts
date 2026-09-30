import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";
import { previewDomainExpansion } from "@/lib/domain-dashboard";

const bodyValidator = z.object({
  integrationId: z.string().min(1),
  expansionString: z.string().trim().min(1),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator =
  z.custom<Awaited<ReturnType<typeof previewDomainExpansion>>>();

type PreviewExpansionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createPreviewExpansionHandler = ({
  preview = previewDomainExpansion,
}: {
  preview?: (
    integrationId: string,
    expansionString: string,
  ) => ReturnType<typeof previewDomainExpansion>;
} = {}): PreviewExpansionHandler => {
  return async (data) => {
    try {
      const expansion = await preview(
        data.body.integrationId,
        data.body.expansionString,
      );

      return successResponse(expansion);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return errorResponse(
        `Expansion preview failed: ${message}`,
        undefined,
        502,
      );
    }
  };
};

export const handler: PreviewExpansionHandler = createPreviewExpansionHandler();
