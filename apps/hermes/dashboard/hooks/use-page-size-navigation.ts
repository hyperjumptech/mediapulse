import { useRouter } from "next/navigation";
import { useCallback } from "react";

export const usePageSizeNavigation = (
  hrefForPageSize: (pageSize: number) => string,
) => {
  const router = useRouter();

  return useCallback(
    (value: string) => {
      router.push(hrefForPageSize(Number(value)), { scroll: false });
    },
    [router, hrefForPageSize],
  );
};
