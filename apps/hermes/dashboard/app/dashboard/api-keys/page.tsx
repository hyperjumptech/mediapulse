import { Plus } from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SectionSkeleton } from "@/components/page-skeletons";
import { Button } from "@workspace/ui/components/button";

import { ApiKeysSection } from "./api-keys-section";
import { CreateApiKeyModal } from "./create-api-key-modal";

const ApiKeysPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Create keys for Cursor MCP and other programmatic access. Each key acts as the admin who created it."
        actions={
          <CreateApiKeyModal
            trigger={
              <Button>
                <Plus aria-hidden />
                Create API key
              </Button>
            }
          />
        }
      />
      <Suspense fallback={<SectionSkeleton />}>
        <ApiKeysSection />
      </Suspense>
    </div>
  );
};

export default ApiKeysPage;
