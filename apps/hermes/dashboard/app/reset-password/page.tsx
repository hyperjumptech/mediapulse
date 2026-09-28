import Link from "next/link";

import { Button } from "@workspace/ui/components/button";

import { AuthPageShell } from "@/components/auth-page-shell";

import { ResetPasswordForm } from "./reset-password-form";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

const Page = async ({ searchParams }: PageProps) => {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token?.trim();

  if (!token) {
    return (
      <AuthPageShell
        title="Invalid link"
        description="This password reset link is missing a token. Request a new link below."
      >
        <Button asChild className="w-full">
          <Link href="/login/forgot-password">Forgot password</Link>
        </Button>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title="Set a new password"
      description="Choose a new password for your Hermes admin account."
    >
      <ResetPasswordForm token={token} />
    </AuthPageShell>
  );
};

export default Page;
