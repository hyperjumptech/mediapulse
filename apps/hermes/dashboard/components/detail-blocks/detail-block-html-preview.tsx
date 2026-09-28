import {
  resolvePath,
  type DetailBlockHtmlPreview,
} from "@hermes/domain-contract";

import { DetailBlockSectionHeader } from "./detail-block-section-header";

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
    <section className="flex min-w-0 flex-col gap-4">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <iframe
        srcDoc={html}
        sandbox="allow-popups"
        title={block.label ?? "HTML preview"}
        className="h-[min(600px,70vh)] w-full max-w-3xl rounded-md border bg-background"
      />
    </section>
  );
};
