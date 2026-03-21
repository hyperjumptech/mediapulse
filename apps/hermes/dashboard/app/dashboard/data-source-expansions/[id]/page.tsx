import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getDataSourceExpansionById } from "@/lib/data-source-expansions";

import { DataSourceExpansionForm } from "../data-source-expansion-form";

/**
 * Edit data source expansion page. Loads expansion by id and renders form with initial values.
 */
const EditDataSourceExpansionPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const expansion = await getDataSourceExpansionById(id);

  if (!expansion) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">
        Edit: {expansion.name}
      </h1>
      <DataSourceExpansionForm
        mode="edit"
        id={expansion.id}
        initialName={expansion.name}
        initialExpansionString={expansion.expansionString}
        initialDescription={expansion.description}
      />
    </div>
  );
};

export default withAuthProtection(EditDataSourceExpansionPage);
