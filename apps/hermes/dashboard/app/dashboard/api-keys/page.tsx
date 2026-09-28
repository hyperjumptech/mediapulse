import { Suspense } from "react";

import { SectionSkeleton } from "@/components/page-skeletons";

import { ApiKeysSection } from "./api-keys-section";
import { CreateApiKeyModal } from "./create-api-key-modal";

const ApiKeysPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<SectionSkeleton />}>
        <ApiKeysSection />
      </Suspense>
      <CreateApiKeyModal />
    </div>
  );
};

export default ApiKeysPage;
