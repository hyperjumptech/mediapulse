import { env } from "@hermes/env";
import { notFound } from "next/navigation";

import { HermesMcpApiKeysFixture } from "./hermes-mcp-api-keys-fixture";

/**
 * Dev-only API keys UI fixture for issue #496 visual proof.
 */
const HermesMcpApiKeysDevPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }> | { variant?: string };
}) => {
  if (env.NODE_ENV !== "development") {
    notFound();
  }

  const resolved = await Promise.resolve(searchParams);
  const variant =
    resolved.variant === "list"
      ? "list"
      : resolved.variant === "create-modal"
        ? "create-modal"
        : "empty";

  return <HermesMcpApiKeysFixture variant={variant} />;
};

export default HermesMcpApiKeysDevPage;
