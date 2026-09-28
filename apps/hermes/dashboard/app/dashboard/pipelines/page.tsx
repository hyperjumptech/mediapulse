import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ListBodySkeleton } from "@/components/page-skeletons";

import { PipelinesSection } from "./pipelines-section";

const PipelinesPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pipelines"
        description="Create and manage pipelines and their steps."
      />
      <Suspense fallback={<ListBodySkeleton />}>
        <PipelinesSection />
      </Suspense>
    </div>
  );
};

export default PipelinesPage;
