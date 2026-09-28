import type { ReactNode } from "react";
import Link from "next/link";
import { Workflow } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

type AuthPageShellProps = {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export const AuthPageShell = ({
  title,
  description,
  children,
  footer,
}: AuthPageShellProps) => (
  <div className="flex min-h-svh flex-col items-center justify-center bg-muted px-4 py-10 md:px-10">
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex items-center gap-2 self-center text-base font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Workflow className="size-4" aria-hidden="true" />
        </span>
        Hermes
      </div>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="text-xl font-semibold">{title}</h1>
          </CardTitle>
          <CardDescription className="text-balance">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer ? (
        <div className="text-center text-xs text-balance text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  </div>
);

type AuthFooterLinkProps = {
  href: string;
  children: ReactNode;
};

export const AuthFooterLink = ({ href, children }: AuthFooterLinkProps) => (
  <p className="text-center text-sm">
    <Link
      href={href}
      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  </p>
);
