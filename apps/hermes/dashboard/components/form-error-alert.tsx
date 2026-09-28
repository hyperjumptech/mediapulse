import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { cn } from "@workspace/ui/lib/utils";

type FormErrorAlertProps = {
  message: string;
  className?: string;
};

export const FormErrorAlert = ({ message, className }: FormErrorAlertProps) => (
  <Alert
    variant="destructive"
    className={cn("border-destructive/30 bg-destructive/5", className)}
  >
    <CircleAlert aria-hidden="true" />
    <AlertDescription>{message}</AlertDescription>
  </Alert>
);
