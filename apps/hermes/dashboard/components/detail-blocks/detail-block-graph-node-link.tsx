"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

const isInternalHref = (href: string) =>
  href.startsWith("/") && !href.startsWith("//");

const isPlainLeftClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export const DetailBlockGraphNodeLink = ({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) => {
  const router = useRouter();
  const navigatesInApp = !external && isInternalHref(href);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!navigatesInApp || event.defaultPrevented || !isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    router.push(href);
  };

  const handlePointerEnter = () => {
    if (navigatesInApp) {
      router.prefetch(href);
    }
  };

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
    >
      {children}
    </a>
  );
};
