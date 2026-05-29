"use client";

import { useEffect, useState } from "react";

/**
 * Tracks elapsed milliseconds from an ISO start instant, updating every second.
 *
 * @param startIso - ISO-8601 timestamp when the step started.
 * @param nowMs - Injectable clock for tests (defaults to `Date.now()`).
 * @returns Elapsed milliseconds since `startIso`.
 */
export const useLiveElapsed = (
  startIso: string,
  nowMs: () => number = Date.now,
): number => {
  const [elapsedMs, setElapsedMs] = useState(() =>
    Math.max(0, nowMs() - Date.parse(startIso)),
  );

  useEffect(() => {
    const tick = () => {
      setElapsedMs(Math.max(0, nowMs() - Date.parse(startIso)));
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [startIso, nowMs]);

  return elapsedMs;
};
