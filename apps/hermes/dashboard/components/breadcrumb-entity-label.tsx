"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { DashboardEntityLabels } from "@/lib/dashboard-routes";

type UnregisterBreadcrumbEntityLabel = () => void;

type RegisterBreadcrumbEntityLabel = (
  segment: string,
  label: string,
) => UnregisterBreadcrumbEntityLabel;

type BreadcrumbEntityLabelProps = {
  segment: string;
  label: string;
};

const noEntityLabels: DashboardEntityLabels = new Map();

const unregisterNothing: UnregisterBreadcrumbEntityLabel = () => undefined;

const registerNothing: RegisterBreadcrumbEntityLabel = () => unregisterNothing;

const BreadcrumbEntityLabelsContext =
  createContext<DashboardEntityLabels>(noEntityLabels);

const RegisterBreadcrumbEntityLabelContext =
  createContext<RegisterBreadcrumbEntityLabel>(registerNothing);

const addEntityLabel = (
  entityLabels: DashboardEntityLabels,
  segment: string,
  label: string,
): DashboardEntityLabels => {
  if (entityLabels.get(segment) === label) {
    return entityLabels;
  }

  return new Map(entityLabels).set(segment, label);
};

const removeEntityLabel = (
  entityLabels: DashboardEntityLabels,
  segment: string,
  label: string,
): DashboardEntityLabels => {
  if (entityLabels.get(segment) !== label) {
    return entityLabels;
  }

  const remainingEntityLabels = new Map(entityLabels);
  remainingEntityLabels.delete(segment);

  return remainingEntityLabels;
};

const useBreadcrumbEntityLabelsState = () => {
  const [entityLabels, setEntityLabels] =
    useState<DashboardEntityLabels>(noEntityLabels);

  const registerEntityLabel = useCallback<RegisterBreadcrumbEntityLabel>(
    (segment, label) => {
      setEntityLabels((currentEntityLabels) =>
        addEntityLabel(currentEntityLabels, segment, label),
      );

      return () => {
        setEntityLabels((currentEntityLabels) =>
          removeEntityLabel(currentEntityLabels, segment, label),
        );
      };
    },
    [],
  );

  return useMemo(
    () => ({ entityLabels, registerEntityLabel }),
    [entityLabels, registerEntityLabel],
  );
};

export const BreadcrumbEntityLabelsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { entityLabels, registerEntityLabel } =
    useBreadcrumbEntityLabelsState();

  return (
    <RegisterBreadcrumbEntityLabelContext.Provider value={registerEntityLabel}>
      <BreadcrumbEntityLabelsContext.Provider value={entityLabels}>
        {children}
      </BreadcrumbEntityLabelsContext.Provider>
    </RegisterBreadcrumbEntityLabelContext.Provider>
  );
};

export const useBreadcrumbEntityLabels = (): DashboardEntityLabels =>
  useContext(BreadcrumbEntityLabelsContext);

export const useBreadcrumbEntityLabel = (segment: string, label: string) => {
  const registerEntityLabel = useContext(RegisterBreadcrumbEntityLabelContext);
  const trimmedLabel = label.trim();

  useLayoutEffect(() => {
    if (!segment || !trimmedLabel) {
      return undefined;
    }

    return registerEntityLabel(segment, trimmedLabel);
  }, [registerEntityLabel, segment, trimmedLabel]);
};

export const BreadcrumbEntityLabel = ({
  segment,
  label,
}: BreadcrumbEntityLabelProps) => {
  useBreadcrumbEntityLabel(segment, label);

  return null;
};
