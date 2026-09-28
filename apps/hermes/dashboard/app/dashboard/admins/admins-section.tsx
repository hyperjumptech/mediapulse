import { Users } from "lucide-react";

import { DataTableCard } from "@/components/data-table/data-table-card";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import { loadHermesAdminsForPage } from "@/lib/hermes-admins-page";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";
import { Badge } from "@workspace/ui/components/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { AdminRowActions } from "./admin-row-actions";

const AdminsEmptyState = () => {
  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Users aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No admins yet</EmptyTitle>
        <EmptyDescription>
          Use the CLI or “Add admin” to create one.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

export const AdminsSection = async () => {
  const [admins, currentUser] = await Promise.all([
    loadHermesAdminsForPage(),
    requireDashboardAdmin(),
  ]);

  if (admins.length === 0) {
    return (
      <DataTableCard>
        <AdminsEmptyState />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((admin) => {
            const isCurrentUser = admin.id === currentUser.id;

            return (
              <TableRow key={admin.id}>
                <TableCell className="pl-4">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{admin.name}</span>
                    {isCurrentUser ? <Badge variant="muted">You</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {admin.email}
                </TableCell>
                <TableCell>
                  {admin.isActive ? (
                    <StatusBadge status="active" label="Active" />
                  ) : (
                    <StatusBadge status="disabled" label="Disabled" />
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                  <DateTime value={admin.createdAt} style="date" />
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <AdminRowActions
                    admin={admin}
                    currentUserId={currentUser.id}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
