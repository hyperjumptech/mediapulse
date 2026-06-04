import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getSectionCoverageRollupForTicker } from "@/lib/section-coverage-rollup";
import type { SectionCoverageVersionRow } from "@/lib/section-coverage-rollup";

import { SectionCoverageContent } from "./section-coverage-content";

const DEFAULT_WINDOW_DAYS = 30;

const SectionCoveragePage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{ ticker?: string; window?: string }>
    | { ticker?: string; window?: string };
}) => {
  const resolved = await Promise.resolve(searchParams);
  const tickerId = resolved.ticker?.trim() ?? "";
  const windowDays = Math.min(
    365,
    Math.max(
      1,
      parseInt(resolved.window ?? String(DEFAULT_WINDOW_DAYS), 10) ||
        DEFAULT_WINDOW_DAYS,
    ),
  );

  let rows: SectionCoverageVersionRow[] = [];
  if (tickerId) {
    try {
      rows = await getSectionCoverageRollupForTicker(tickerId, windowDays);
    } catch {
      rows = [];
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Section coverage"
        description={`Per-section query coverage and newsletter fill grouped by contract version over the last ${windowDays} days.`}
      />
      <SectionCoverageContent
        tickerId={tickerId}
        windowDays={windowDays}
        rows={rows}
      />
    </div>
  );
};

export default withAuthProtection(SectionCoveragePage);
