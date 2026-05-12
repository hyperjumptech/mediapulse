import { RegistrationForm } from "@/components/registration-form";
import { loadRegistrationTickers } from "@/lib/load-registration-tickers";

/**
 * User registration page using a login-05 style centered layout.
 * Loads ticker choices from agent-data-api (backed by the Mediapulse database) on the server.
 *
 * @returns {Promise<JSX.Element>} The rendered registration page.
 */
const Page = async () => {
  const tickers = await loadRegistrationTickers();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <RegistrationForm tickers={tickers} />
      </div>
    </div>
  );
};

export default Page;
