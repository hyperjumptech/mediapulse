"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { SectionCoverageVersionRow } from "@/lib/section-coverage-rollup";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

const SECTION_LABELS: Record<string, string> = {
  industryPulse: "Industry Pulse",
  competitiveLandscape: "Competitive Landscape",
  dealsAndMovements: "Deals & Movements",
  regulatoryPolicyWatch: "Regulatory & Policy Watch",
  disruptorsOrTech: "Disruptors / Tech",
  quickHits: "Quick Hits",
};

const SECTION_ORDER = [
  "industryPulse",
  "competitiveLandscape",
  "dealsAndMovements",
  "regulatoryPolicyWatch",
  "disruptorsOrTech",
  "quickHits",
];

type SectionCoverageContentProps = {
  tickerId: string;
  windowDays: number;
  rows: SectionCoverageVersionRow[];
};

/**
 * Renders the ticker input form and coverage→fill comparison table.
 */
export const SectionCoverageContent = ({
  tickerId,
  windowDays,
  rows,
}: SectionCoverageContentProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inputTickerId, setInputTickerId] = useState(tickerId);
  const [inputWindowDays, setInputWindowDays] = useState(String(windowDays));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (inputTickerId.trim()) {
      params.set("ticker", inputTickerId.trim());
    } else {
      params.delete("ticker");
    }
    const days = parseInt(inputWindowDays, 10);
    if (!isNaN(days) && days > 0) {
      params.set("window", String(days));
    } else {
      params.delete("window");
    }
    router.push(`/dashboard/section-coverage?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticker-input">Ticker ID</Label>
          <Input
            id="ticker-input"
            placeholder="e.g. ticker-uuid"
            value={inputTickerId}
            onChange={(event) => setInputTickerId(event.target.value)}
            className="w-72"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="window-input">Window (days)</Label>
          <Input
            id="window-input"
            type="number"
            min={1}
            max={365}
            value={inputWindowDays}
            onChange={(event) => setInputWindowDays(event.target.value)}
            className="w-28"
          />
        </div>
        <Button type="submit">Load</Button>
      </form>

      {tickerId && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No coverage data found for this ticker in the selected window.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Section</TableHead>
                {rows.map((row) => (
                  <TableHead
                    key={row.contractVersion ?? "none"}
                    colSpan={2}
                    className="text-center"
                  >
                    {row.contractVersion !== null
                      ? `Contract v${row.contractVersion}`
                      : "No contract"}
                    <div className="text-xs font-normal text-muted-foreground">
                      {row.coverageRunCount} QA / {row.fillRunCount} CG runs
                    </div>
                  </TableHead>
                ))}
              </TableRow>
              <TableRow>
                <TableHead />
                {rows.map((row) => (
                  <>
                    <TableHead
                      key={`${row.contractVersion ?? "none"}-cov`}
                      className="text-center text-xs"
                    >
                      Avg queries
                    </TableHead>
                    <TableHead
                      key={`${row.contractVersion ?? "none"}-fill`}
                      className="text-center text-xs"
                    >
                      Avg bullets
                    </TableHead>
                  </>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SECTION_ORDER.map((sectionId) => (
                <TableRow key={sectionId}>
                  <TableCell className="font-medium">
                    {SECTION_LABELS[sectionId] ?? sectionId}
                  </TableCell>
                  {rows.map((row) => {
                    const entry = row.bySection[sectionId];
                    const avgCoverage = entry?.avgCoverage ?? 0;
                    const avgFill = entry?.avgFill ?? null;
                    return (
                      <>
                        <TableCell
                          key={`${row.contractVersion ?? "none"}-${sectionId}-cov`}
                          className={`text-center tabular-nums ${avgCoverage === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {avgCoverage.toFixed(1)}
                        </TableCell>
                        <TableCell
                          key={`${row.contractVersion ?? "none"}-${sectionId}-fill`}
                          className={`text-center tabular-nums ${avgFill === null || avgFill === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {avgFill !== null ? avgFill.toFixed(1) : "—"}
                        </TableCell>
                      </>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
