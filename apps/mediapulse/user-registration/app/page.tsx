import { RegistrationForm } from "@/components/registration-form";
import { tickersArraySchema, type Ticker } from "@/lib/tickers";
import tickersJson from "../public/tickers.json";

const tickers: Ticker[] = tickersArraySchema.parse(tickersJson);

/**
 * User registration page using a login-05 style centered layout.
 * Reads ticker data from the bundled `public/tickers.json` so the page
 * has no server-side dependencies (database, env vars).
 *
 * @returns {JSX.Element} The rendered registration page.
 */
const Page = () => (
  <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
    <div className="w-full max-w-sm">
      <RegistrationForm tickers={tickers} />
    </div>
  </div>
);

export default Page;
