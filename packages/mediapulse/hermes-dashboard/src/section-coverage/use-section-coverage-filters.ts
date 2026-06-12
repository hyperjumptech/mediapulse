"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export type UseSectionCoverageFiltersParams = {
  tickerId: string;
  windowDays: number;
};

/**
 * Holds ticker/window form state and navigates with updated query params on submit.
 *
 * @param params - Initial ticker id and window length from the server page.
 * @returns Controlled input values and the form submit handler.
 */
export const useSectionCoverageFilters = ({
  tickerId,
  windowDays,
}: UseSectionCoverageFiltersParams) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inputTickerId, setInputTickerId] = useState(tickerId);
  const [inputWindowDays, setInputWindowDays] = useState(String(windowDays));

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      if (inputTickerId.trim()) {
        params.set("ticker", inputTickerId.trim());
      } else {
        params.delete("ticker");
      }
      const days = parseInt(inputWindowDays, 10);
      if (!isNaN(days) && days > 0) {
        params.set("window", String(days));
      } else {
        params.delete("window");
      }
      router.push(`/dashboard/section-coverage?${params.toString()}`);
    },
    [inputTickerId, inputWindowDays, router, searchParams],
  );

  return {
    inputTickerId,
    setInputTickerId,
    inputWindowDays,
    setInputWindowDays,
    handleSubmit,
  };
};
