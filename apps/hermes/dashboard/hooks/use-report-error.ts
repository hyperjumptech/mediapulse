import { useEffect } from "react";

export const useReportError = (error: Error) => {
  useEffect(() => {
    console.error(error);
  }, [error]);
};
