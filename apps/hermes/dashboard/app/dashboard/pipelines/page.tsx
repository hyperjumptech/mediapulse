import { Suspense } from "react";

import {
  EntityFormModalCreateButton,
  EntityFormModalProvider,
} from "@/components/entity-form-modal-provider";
import { PageHeader } from "@/components/page-header";
import { ListBodySkeleton } from "@/components/page-skeletons";

import { PipelinesSection } from "./pipelines-section";

const PipelinesPage = () => {
  return (
    <EntityFormModalProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          description="Create and manage pipelines and their steps."
          actions={<EntityFormModalCreateButton label="New pipeline" />}
        />
        <Suspense fallback={<ListBodySkeleton />}>
          <PipelinesSection />
        </Suspense>
      </div>
    </EntityFormModalProvider>
  );
};

export default PipelinesPage;
