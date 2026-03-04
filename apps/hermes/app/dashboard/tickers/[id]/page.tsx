import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getTickerById } from "@/lib/tickers";

import { TickerEditForm } from "./ticker-edit-form";

/**
 * Normalizes Prisma JsonValue to the shape expected by TickerEditForm (object or null).
 */
function toTickerMetadata(
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

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
        initialMetadata={toTickerMetadata(ticker.metadata)}
      />
    </div>
  );
};

export default withAuthProtection(TickerEditPage);
