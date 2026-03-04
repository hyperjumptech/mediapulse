import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getTickerById } from "@/lib/tickers";

import { TickerEditForm } from "./ticker-edit-form";

/**
 * Ticker detail/edit page. Loads ticker by id and renders edit form.
 */
const TickerEditPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const ticker = await getTickerById(id);

  if (!ticker) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Edit ticker: {ticker.symbol}
        </h1>
        <p className="text-muted-foreground">
          Update symbol, name, and metadata (JSON) for this ticker.
        </p>
      </div>

      <TickerEditForm
        tickerId={ticker.id}
        initialSymbol={ticker.symbol}
        initialName={ticker.name}
        initialMetadata={ticker.metadata}
      />
    </div>
  );
};

export default withAuthProtection(TickerEditPage);
