"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Plus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import {
  useEntityFormModalState,
  type EntityFormModalController,
} from "@/hooks/use-entity-form-modal-state";

const EntityFormModalContext = createContext<EntityFormModalController | null>(
  null,
);

export const EntityFormModalProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const controller = useEntityFormModalState();

  return (
    <EntityFormModalContext value={controller}>
      {children}
    </EntityFormModalContext>
  );
};

export const useEntityFormModal = (): EntityFormModalController => {
  const controller = useContext(EntityFormModalContext);
  if (!controller) {
    throw new Error(
      "useEntityFormModal must be used inside an EntityFormModalProvider",
    );
  }

  return controller;
};

export const EntityFormModalCreateButton = ({ label }: { label: string }) => {
  const { openCreate } = useEntityFormModal();

  return (
    <Button type="button" onClick={openCreate}>
      <Plus aria-hidden />
      {label}
    </Button>
  );
};
