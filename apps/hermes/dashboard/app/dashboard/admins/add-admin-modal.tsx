"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useFormAction } from "@/app/dashboard/admins/actions/create/.generated/use-form-action";

type AddAdminModalProps = {
  trigger?: React.ReactNode;
};

/**
 * Owns add-admin dialog open state, form action wiring, and refresh after success.
 */
const useAddAdminModalState = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(
    () => (state && state.status === false ? String(state.message) : null),
    [state],
  );

  const successId = useMemo(
    () =>
      state && state.status === true && state.data && "id" in state.data
        ? String((state.data as { id: string }).id)
        : null,
    [state],
  );

  const handledSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    if (successId != null && handledSuccessRef.current !== successId) {
      handledSuccessRef.current = successId;
      setOpen(false);
      router.refresh();
    }
  }, [router, successId]);

  return {
    open,
    setOpen,
    FormWithAction,
    pending,
    errorMessage,
  };
};

/**
 * Modal to create a new Hermes dashboard admin (email, name, initial password).
 */
export const AddAdminModal = ({ trigger }: AddAdminModalProps) => {
  const { open, setOpen, FormWithAction, pending, errorMessage } =
    useAddAdminModalState();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add admin</DialogTitle>
        </DialogHeader>
        <FormWithAction className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-admin-name">Name</Label>
            <Input
              id="add-admin-name"
              name="body.name"
              type="text"
              required
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-admin-email">Email</Label>
            <Input
              id="add-admin-email"
              name="body.email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-admin-password">Initial password</Label>
            <Input
              id="add-admin-password"
              name="body.password"
              type="password"
              required
              minLength={4}
              autoComplete="new-password"
            />
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create admin"}
            </Button>
          </DialogFooter>
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};
