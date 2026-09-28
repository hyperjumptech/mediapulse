import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SectionSkeleton } from "@/components/page-skeletons";
import { Button } from "@workspace/ui/components/button";

import { ApiKeysSection } from "./api-keys-section";
import { CreateApiKeyModal } from "./create-api-key-modal";

const ApiKeysPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="API keys"
        description="Create keys for Cursor MCP and other programmatic access. Each key acts as the admin who created it."
      />
      <div className="flex justify-end">
        <CreateApiKeyModal trigger={<Button>Create API key</Button>} />
      </div>
      <Suspense fallback={<SectionSkeleton />}>
        <ApiKeysSection />
      </Suspense>
    </div>
  );
};

export default ApiKeysPage;
