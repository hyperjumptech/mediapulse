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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Admins"
          description="Manage who can sign in to the Hermes dashboard. Disabled admins cannot log in."
        />
        <AddAdminModal
          trigger={<Button className="shrink-0">Add admin</Button>}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[56px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No admins found. Use the CLI or “Add admin” to create one.
              </TableCell>
            </TableRow>
          ) : (
            admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell>{admin.name}</TableCell>
                <TableCell className="text-sm">{admin.email}</TableCell>
                <TableCell>
                  {admin.isActive ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(admin.createdAt, "MMM d, yyyy")}
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
  );
};

export default withAuthProtection(AdminsPage);
