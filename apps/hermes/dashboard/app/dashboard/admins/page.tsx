import { format } from "date-fns";

import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getDashboardSession } from "@/lib/auth-dashboard";
import { loadHermesAdminsForPage } from "@/lib/hermes-admins-page";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { AddAdminModal } from "./add-admin-modal";
import { AdminRowActions } from "./admin-row-actions";

/**
 * Lists Hermes dashboard admins; mutations require an active admin session (enforced in layout and actions).
 */
const AdminsPage = async () => {
  const [admins, session] = await Promise.all([
    loadHermesAdminsForPage(),
    getDashboardSession(),
  ]);

  const currentUserId = session?.id ?? "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Admins"
        description="Manage who can sign in to the Hermes dashboard. Disabled admins cannot log in."
      />
      <div className="flex justify-end">
        <AddAdminModal trigger={<Button>Add admin</Button>} />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              <TableHead className="w-[160px]">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[120px]">Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No admins yet. Use the CLI or “Add admin” to create one.
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {admin.email}
                  </TableCell>
                  <TableCell>
                    {admin.isActive ? (
                      <Badge variant="secondary" className="font-normal">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Disabled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(admin.createdAt, "LLL d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <AdminRowActions
                      admin={admin}
                      currentUserId={currentUserId}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default withAuthProtection(AdminsPage);
