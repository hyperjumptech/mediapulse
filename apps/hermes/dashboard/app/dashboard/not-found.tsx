import Link from "next/link";

import { Button } from "@workspace/ui/components/button";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Not found</h2>
        <p className="text-sm text-muted-foreground">
          This item does not exist or was deleted.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
