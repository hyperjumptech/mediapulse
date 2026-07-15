/**
 * Empty-state placeholder for detail-block tables — a bordered card with centered muted text, so an
 * empty result reads as a deliberate state rather than a stray line of copy.
 *
 * @param props.message - Sentence shown to the reviewer.
 */
export const DetailBlockEmptyState = ({ message }: { message: string }) => (
  <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
    {message}
  </div>
);
