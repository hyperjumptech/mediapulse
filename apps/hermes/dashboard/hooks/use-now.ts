import { useEffect, useState } from "react";

const DEFAULT_REFRESH_MILLISECONDS = 30_000;

export const useNow = (refreshMilliseconds = DEFAULT_REFRESH_MILLISECONDS) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), refreshMilliseconds);

    return () => clearInterval(interval);
  }, [refreshMilliseconds]);

  return now;
};
