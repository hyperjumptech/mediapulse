import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

export const PaginationStepButton = ({
  href,
  label,
  rel,
  icon: Icon,
  className,
}: {
  href?: string;
  label: string;
  rel?: "prev" | "next";
  icon: LucideIcon;
  className?: string;
}) => {
  const buttonClassName = cn("size-8", className);
  if (!href) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={buttonClassName}
        disabled
      >
        <span className="sr-only">{label}</span>
        <Icon aria-hidden />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="icon" className={buttonClassName} asChild>
      <Link href={href} rel={rel} scroll={false}>
        <span className="sr-only">{label}</span>
        <Icon aria-hidden />
      </Link>
    </Button>
  );
};
