import { Suspense } from "react";

import { EntityFormModalProvider } from "@/components/entity-form-modal-provider";
import { ListBodySkeleton } from "@/components/page-skeletons";

import { PipelinesSection } from "./pipelines-section";

const PipelinesPage = () => {
  return (
    <EntityFormModalProvider>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<ListBodySkeleton />}>
          <PipelinesSection />
        </Suspense>
      </div>
    </EntityFormModalProvider>
  );
};

export default PipelinesPage;
