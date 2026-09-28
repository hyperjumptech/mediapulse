import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SectionSkeleton } from "@/components/page-skeletons";
import { Button } from "@workspace/ui/components/button";

import { DomainIntegrationsSection } from "./domain-integrations-section";

const DomainIntegrationsPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Domain integrations"
        description="Each integration has a stable id, used in env and URLs, and a separate API key that is shown once when you create it."
        actions={
          <Button asChild>
            <Link href="/dashboard/domain-integrations/create">
              <Plus aria-hidden />
              New integration
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<SectionSkeleton />}>
        <DomainIntegrationsSection />
      </Suspense>
    </div>
  );
};

export default DomainIntegrationsPage;
