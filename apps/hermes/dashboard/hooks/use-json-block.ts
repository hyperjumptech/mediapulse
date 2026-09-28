import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { formatJsonBlockValue } from "@/lib/format-json-block-value";

const OVERFLOW_TOLERANCE_PX = 1;

const isBodyOverflowing = (body: HTMLElement): boolean =>
  body.scrollHeight - body.clientHeight > OVERFLOW_TOLERANCE_PX;

const observeBodySize = (body: HTMLElement, onResize: () => void) => {
  if (typeof ResizeObserver === "undefined") {
    return undefined;
  }

  const observer = new ResizeObserver(onResize);
  const observedElements = [body, body.firstElementChild].filter(
    (element): element is Element => element !== null,
  );

  observedElements.forEach((element) => observer.observe(element));

  return () => observer.disconnect();
};

export const useJsonBlock = (value: unknown) => {
  const formatted = useMemo(() => formatJsonBlockValue(value), [value]);
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const { copied, copy } = useCopyToClipboard();
  const [isWrapped, setWrapped] = useState(true);
  const [isExpanded, setExpanded] = useState(false);
  const [isOverflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;

    if (body === null || isExpanded) {
      return undefined;
    }

    const measure = () => setOverflowing(isBodyOverflowing(body));

    measure();

    return observeBodySize(body, measure);
  }, [formatted, isWrapped, isExpanded]);

  const copyFormatted = async () => {
    if (formatted === null) {
      return;
    }

    await copy(formatted);
  };

  const toggleExpanded = () => setExpanded((expanded) => !expanded);

  return {
    formatted,
    bodyId,
    bodyRef,
    copied,
    copyFormatted,
    isWrapped,
    setWrapped,
    isExpanded,
    canExpand: isOverflowing || isExpanded,
    toggleExpanded,
  };
};
