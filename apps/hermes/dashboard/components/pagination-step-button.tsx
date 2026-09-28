import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

export const PaginationStepButton = ({
  href,
  label,
  rel,
  icon: Icon,
}: {
  href?: string;
  label: string;
  rel: "prev" | "next";
  icon: LucideIcon;
}) => {
  if (!href) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled
        aria-label={label}
      >
        <Icon aria-hidden />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="icon-sm" asChild>
      <Link href={href} rel={rel} aria-label={label}>
        <Icon aria-hidden />
      </Link>
    </Button>
  );
};
