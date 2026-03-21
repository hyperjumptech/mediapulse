import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getRegisteredDatabases } from "@/lib/registered-databases";

/**
 * Registered databases page for expansion storage targets.
 * Shows current registrations and simple create form.
 */
const RegisteredDatabasesPage = async () => {
  const rows = await getRegisteredDatabases();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Registered Databases"
        description="Manage database connections used for Mediapulse data-source expansion."
      />

      <form
        action="/dashboard/registered-databases/actions/create"
        method="post"
        className="grid gap-3 rounded-lg border p-4"
      >
        <div className="grid gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="connectionString">Connection string</Label>
          <Input
            id="connectionString"
            name="connectionString"
            required
            type="password"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="allowlistedTables">
            Allowlisted tables (comma-separated)
          </Label>
          <textarea
            id="allowlistedTables"
            name="allowlistedTables"
            className="min-h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked name="isActive" type="checkbox" />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="isDefault" type="checkbox" />
            Default
          </label>
        </div>
        <div>
          <Button type="submit">Create connection</Button>
        </div>
      </form>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3">Name</th>
              <th className="p-3">Status</th>
              <th className="p-3">Default</th>
              <th className="p-3">Allowlist</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-3">{row.name}</td>
                <td className="p-3">{row.isActive ? "Active" : "Inactive"}</td>
                <td className="p-3">{row.isDefault ? "Yes" : "No"}</td>
                <td className="p-3">
                  {row.allowlistedTables.length > 0
                    ? row.allowlistedTables.join(", ")
                    : "Any"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={4}>
                  No registered databases yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default withAuthProtection(RegisteredDatabasesPage);
