import { Suspense } from "react";

import { SectionSkeleton } from "@/components/page-skeletons";

import { DomainIntegrationsSection } from "./domain-integrations-section";

const DomainIntegrationsPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<SectionSkeleton />}>
        <DomainIntegrationsSection />
      </Suspense>
    </div>
  );
};

export default DomainIntegrationsPage;
