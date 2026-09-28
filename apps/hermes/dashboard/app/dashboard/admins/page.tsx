import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SectionSkeleton } from "@/components/page-skeletons";
import { Button } from "@workspace/ui/components/button";

import { AddAdminModal } from "./add-admin-modal";
import { AdminsSection } from "./admins-section";

const AdminsPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Admins"
        description="Manage who can sign in to the Hermes dashboard. Disabled admins cannot log in."
      />
      <div className="flex justify-end">
        <AddAdminModal trigger={<Button>Add admin</Button>} />
      </div>
      <Suspense fallback={<SectionSkeleton />}>
        <AdminsSection />
      </Suspense>
    </div>
  );
};

export default AdminsPage;
