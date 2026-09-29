"use client";

import { useEffect, useState } from "react";

export type HttpTriggerStartMode = "token" | "event";

export const isHttpTriggerStartMode = (
  value: string,
): value is HttpTriggerStartMode => value === "token" || value === "event";

export const useHttpTriggerStartMode = (
  defaultStartMode: HttpTriggerStartMode,
) => {
  const [startMode, setStartMode] =
    useState<HttpTriggerStartMode>(defaultStartMode);

  useEffect(() => {
    setStartMode(defaultStartMode);
  }, [defaultStartMode]);

  const changeStartMode = (value: string) => {
    if (isHttpTriggerStartMode(value)) {
      setStartMode(value);
    }
  };

  return { startMode, changeStartMode };
};
