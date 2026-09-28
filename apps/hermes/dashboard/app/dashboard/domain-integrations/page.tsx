import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SectionSkeleton } from "@/components/page-skeletons";
import { Button } from "@workspace/ui/components/button";

import { DomainIntegrationsSection } from "./domain-integrations-section";

const DomainIntegrationsPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Domain integrations"
        description="Each row has an integration id (stable string for env and URLs) and a separate domain integration API key, shown once when you create the integration—not the same value."
      />
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/dashboard/domain-integrations/create">
            New integration
          </Link>
        </Button>
      </div>
      <Suspense fallback={<SectionSkeleton />}>
        <DomainIntegrationsSection />
      </Suspense>
    </div>
  );
};

export default DomainIntegrationsPage;
