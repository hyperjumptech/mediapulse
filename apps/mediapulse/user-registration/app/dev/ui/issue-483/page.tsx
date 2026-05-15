import { notFound } from "next/navigation";

import { env } from "@mediapulse/env/app-user-registration";

import { HyperjumpProductAttribution } from "@/components/hyperjump-product-attribution";
import { RegistrationForm } from "@/components/registration-form";
import type { Ticker } from "@/lib/tickers";

/**
 * Sample IDX-style tickers for the dev-only registration preview (no agent-data-api).
 */
const DEV_REGISTRATION_TICKERS: Ticker[] = [
  { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
  { KodeEmiten: "TLKM", NamaEmiten: "Telkom Indonesia Tbk" },
];

/**
 * Development-only page that mirrors the real registration layout: full
 * `RegistrationForm` with fixture tickers plus Hyperjump attribution. Use for
 * screenshots and UI review without calling agent-data-api. Returns 404
 * outside `development`.
 *
 * @returns The registration preview layout.
 */
const DevUiIssue483Page = () => {
  if (env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col items-center">
        <RegistrationForm tickers={DEV_REGISTRATION_TICKERS} />
        <HyperjumpProductAttribution />
      </div>
    </div>
  );
};

export default DevUiIssue483Page;
