type PageHeaderProps = {
  /** Main heading text for the page. */
  title: string;
  /** Short description shown below the title. */
  description: string;
};

/**
 * Renders a consistent page title and description block for dashboard pages.
 * Matches the dashboard page pattern: h1 + muted description paragraph.
 */
export const PageHeader = ({ title, description }: PageHeaderProps) => {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};
