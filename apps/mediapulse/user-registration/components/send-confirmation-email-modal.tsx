"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onSendEmail: () => void;
  sending: boolean;
  tickerSymbol?: string;
};

/**
 * Second-step modal for the Other path: collect email and send confirmation link.
 *
 * @param props - Controlled dialog state and submit handlers.
 * @returns Confirmation email dialog.
 */
const SendConfirmationEmailModal = ({
  open,
  onOpenChange,
  email,
  onEmailChange,
  onSendEmail,
  sending,
  tickerSymbol,
}: Props) => {
  const trimmedEmail = email.trim();
  const canSend = trimmedEmail.length > 0 && !sending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm by email</DialogTitle>
          <DialogDescription>
            MediaPulse will send an email with a confirmation link
            {tickerSymbol ? ` for ${tickerSymbol}` : ""}. Click the link to
            finish subscribing.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmation-email">Your email address</Label>
          <Input
            id="confirmation-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSendEmail} disabled={!canSend}>
            {sending ? "Sending…" : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { SendConfirmationEmailModal };
