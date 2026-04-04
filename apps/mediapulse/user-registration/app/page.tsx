import { RegistrationForm } from "@/components/registration-form";
import { prisma } from "@mediapulse/database";
import type { Ticker } from "@/lib/tickers";

/**
 * User registration page using a login-05 style centered layout.
 * Reads ticker data from the database at request time.
 */
const Page = async () => {
  const dbTickers = await prisma.ticker.findMany({
    orderBy: { symbol: "asc" },
  });

  const tickers: Ticker[] = dbTickers.map((t) => ({
    KodeEmiten: t.symbol,
    NamaEmiten: t.name,
  }));

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <RegistrationForm tickers={tickers} />
      </div>
    </div>
  );
};

export default Page;
