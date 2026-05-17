type HyperjumpProductAttributionProps = {
  /**
   * Hyperjump marketing site URL used for the link `href`.
   * Defaults to the canonical production URL.
   */
  companySiteUrl?: string;
};

const DEFAULT_HYPERJUMP_SITE_URL = "https://hyperjump.tech";

/**
 * Renders a short footer line that Mediapulse is a Hyperjump product, with an
 * external link to the Hyperjump website.
 *
 * @param props - Component props.
 * @param props.companySiteUrl - Optional override for the Hyperjump link target URL.
 * @returns The attribution paragraph element.
 */
const HyperjumpProductAttribution = ({
  companySiteUrl = DEFAULT_HYPERJUMP_SITE_URL,
}: HyperjumpProductAttributionProps = {}) => (
  <p className="mt-6 max-w-sm text-balance text-center text-xs text-muted-foreground">
    Mediapulse is a product by{" "}
    <a
      href={companySiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-foreground underline-offset-4 hover:underline"
    >
      Hyperjump
    </a>
    .
  </p>
);

export { HyperjumpProductAttribution, DEFAULT_HYPERJUMP_SITE_URL };
