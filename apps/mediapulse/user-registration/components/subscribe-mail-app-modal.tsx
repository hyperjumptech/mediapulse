"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import type { MailAppChoiceOption } from "@/lib/detect-mail-platform";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: MailAppChoiceOption[];
  onSelectOutlook: () => void;
  onSelectNativeMail: () => void;
  onSelectOther: () => void;
};

/**
 * Modal that lets the user choose how to open their mail app or use email confirmation.
 *
 * @param props - Controlled dialog state and selection handlers.
 * @returns Mail-app choice dialog.
 */
const SubscribeMailAppModal = ({
  open,
  onOpenChange,
  options,
  onSelectOutlook,
  onSelectNativeMail,
  onSelectOther,
}: Props) => {
  const handleSelect = (option: MailAppChoiceOption) => {
    if (option.id === "outlook") {
      onSelectOutlook();
      return;
    }
    if (option.id === "native-mail") {
      onSelectNativeMail();
      return;
    }
    onSelectOther();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose how to subscribe</DialogTitle>
          <DialogDescription>
            Pick a mail app to send your signup email, or let MediaPulse email
            you a confirmation link.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {options.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
              onClick={() => handleSelect(option)}
            >
              <span className="font-medium">{option.title}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {option.description}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { SubscribeMailAppModal };
