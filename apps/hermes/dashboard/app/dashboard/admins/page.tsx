import { Suspense } from "react";

import { SectionSkeleton } from "@/components/page-skeletons";

import { AddAdminModal } from "./add-admin-modal";
import { AdminsSection } from "./admins-section";

const AdminsPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<SectionSkeleton />}>
        <AdminsSection />
      </Suspense>
      <AddAdminModal />
    </div>
  );
};

export default AdminsPage;
