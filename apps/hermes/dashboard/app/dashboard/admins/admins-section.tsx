import { format } from "date-fns";

import { loadHermesAdminsForPage } from "@/lib/hermes-admins-page";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";
import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { AdminRowActions } from "./admin-row-actions";

export const AdminsSection = async () => {
  const [admins, currentUser] = await Promise.all([
    loadHermesAdminsForPage(),
    requireDashboardAdmin(),
  ]);

  return (
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
                    currentUserId={currentUser.id}
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
