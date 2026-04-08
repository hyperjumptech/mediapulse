import Link from "next/link";

import { ResetPasswordForm } from "./reset-password-form";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

const Page = async ({ searchParams }: PageProps) => {
  const sp = await searchParams;
  const token = sp.token?.trim();

  if (!token) {
    return (
      <div className="grid min-h-svh place-items-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold">Invalid link</h1>
          <p className="text-sm text-muted-foreground">
            This password reset link is missing a token. Request a new link
            below.
          </p>
          <Link
            href="/login/forgot-password"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            Forgot password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col bg-muted p-10 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted to-muted-foreground/10" />
        <div className="relative z-20 flex items-center gap-2 font-semibold">
          <span>Hermes</span>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-xs">
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </div>
  );
};

export default Page;
