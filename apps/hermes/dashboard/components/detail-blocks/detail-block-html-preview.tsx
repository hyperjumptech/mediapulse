import {
  resolvePath,
  type DetailBlockHtmlPreview,
} from "@hermes/domain-contract";

import { DetailBlockSectionHeader } from "./detail-block-section-header";

/**
 * Renders an `htmlPreview` detail block — a sandboxed iframe whose body comes
 * from a named field on the detail response. Sandbox is exactly `allow-popups`;
 * no `allow-scripts` and no `allow-same-origin` ever.
 *
 * @param props.block - Manifest definition.
 * @param props.data - Detail response object.
 */
export const DetailBlockHtmlPreviewView = ({
  block,
  data,
}: {
  block: DetailBlockHtmlPreview;
  data: unknown;
}) => {
  const raw = resolvePath(data, block.field);
  const html = typeof raw === "string" ? raw : "";
  return (
    <section className="flex flex-col gap-3">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <iframe
        srcDoc={html}
        sandbox="allow-popups"
        title={block.label ?? "HTML preview"}
        className="h-[600px] w-full max-w-3xl rounded-md border bg-background"
      />
    </section>
  );
};
