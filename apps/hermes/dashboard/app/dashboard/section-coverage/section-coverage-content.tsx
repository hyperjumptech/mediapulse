"use client";

import { Fragment } from "react";
import type { SectionCoverageVersionRow } from "@/lib/section-coverage-rollup";
import { useSectionCoverageFilters } from "./use-section-coverage-filters";
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
  const {
    inputTickerId,
    setInputTickerId,
    inputWindowDays,
    setInputWindowDays,
    handleSubmit,
  } = useSectionCoverageFilters({ tickerId, windowDays });

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
                  <Fragment key={row.contractVersion ?? "none"}>
                    <TableHead className="text-center text-xs">
                      Avg queries
                    </TableHead>
                    <TableHead className="text-center text-xs">
                      Avg bullets
                    </TableHead>
                  </Fragment>
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
                      <Fragment
                        key={`${row.contractVersion ?? "none"}-${sectionId}`}
                      >
                        <TableCell
                          className={`text-center tabular-nums ${avgCoverage === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {avgCoverage.toFixed(1)}
                        </TableCell>
                        <TableCell
                          className={`text-center tabular-nums ${avgFill === null || avgFill === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {avgFill !== null ? avgFill.toFixed(1) : "—"}
                        </TableCell>
                      </Fragment>
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
