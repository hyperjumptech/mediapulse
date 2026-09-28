import { useEffect, useState } from "react";

const DEFAULT_REFRESH_MILLISECONDS = 30_000;

export const useNow = (
  refreshMilliseconds = DEFAULT_REFRESH_MILLISECONDS,
  initialNow?: number,
) => {
  const [now, setNow] = useState(() =>
    initialNow === undefined ? new Date() : new Date(initialNow),
  );

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), refreshMilliseconds);

    return () => clearInterval(interval);
  }, [refreshMilliseconds]);

  return now;
};
