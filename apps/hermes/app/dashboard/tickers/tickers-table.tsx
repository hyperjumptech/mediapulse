import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { TickerRowActions } from "./ticker-row-actions";

import type { TickersPageResult } from "@/lib/tickers";

type TickerRow = TickersPageResult["tickers"][number];

/**
 * Renders the tickers list as a table with Symbol, Name, Created, and row actions dropdown.
 */
export const TickersTable = ({ tickers }: { tickers: TickerRow[] }) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="w-[120px]">Symbol</TableHead>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                No tickers yet.
              </TableCell>
            </TableRow>
          ) : (
            tickers.map((ticker) => (
              <TableRow key={ticker.id}>
                <TableCell className="font-medium">{ticker.symbol}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ticker.name}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {ticker.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <TickerRowActions
                    tickerId={ticker.id}
                    tickerSymbol={ticker.symbol}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
