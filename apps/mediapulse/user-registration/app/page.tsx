import { RegistrationForm } from "@/components/registration-form";
import { readTickers } from "@/lib/read-tickers";

/**
 * User registration page using a login-05 style centered layout.
 * Reads ticker data from public/tickers.json at request time.
 */
const Page = async () => {
  const tickers = await readTickers();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <RegistrationForm tickers={tickers} />
      </div>
    </div>
  );
};

export default Page;
